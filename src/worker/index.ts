import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  authMiddleware,
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// ============= AUTH ENDPOINTS =============

app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  try {
    const body = await c.req.json();

    if (!body.code) {
      return c.json({ error: "No authorization code provided" }, 400);
    }

    const sessionToken = await exchangeCodeForSessionToken(body.code, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });

    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60,
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("Failed to exchange code for session token:", error);
    return c.json({ error: "Authentication failed. Please try again." }, 400);
  }
});

app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// ============= DRIVER ENDPOINTS =============

// Get current driver profile for authenticated user
app.get("/api/driver/profile", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = c.env.DB;

  const driver = await db
    .prepare("SELECT * FROM drivers WHERE user_id = ?")
    .bind(user.id)
    .first();

  if (!driver) {
    return c.json({ error: "Driver profile not found" }, 404);
  }

  return c.json(driver);
});

// Create or update driver profile for authenticated user
app.post(
  "/api/driver/profile",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string(),
      phone: z.string().optional(),
    })
  ),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const db = c.env.DB;
    const { name, phone } = c.req.valid("json");

    // Check if driver already exists
    const existing = await db
      .prepare("SELECT id FROM drivers WHERE user_id = ?")
      .bind(user.id)
      .first();

    if (existing) {
      // Update existing
      await db
        .prepare(
          `UPDATE drivers 
           SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = ?`
        )
        .bind(name, phone || null, user.id)
        .run();

      return c.json({ id: existing.id, success: true });
    } else {
      // Create new
      const result = await db
        .prepare(
          `INSERT INTO drivers (user_id, name, phone, is_active) 
           VALUES (?, ?, ?, 1)`
        )
        .bind(user.id, name, phone || null)
        .run();

      return c.json({ id: result.meta.last_row_id, success: true });
    }
  }
);

// Get all active drivers with their current location (for monitoring dashboard)
app.get("/api/drivers", async (c) => {
  const db = c.env.DB;
  const drivers = await db
    .prepare(
      `SELECT id, name, phone, is_active, current_latitude, current_longitude 
       FROM drivers 
       WHERE is_active = 1`
    )
    .all();
  return c.json(drivers.results);
});

// Get specific driver details
app.get("/api/drivers/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const driver = await db
    .prepare("SELECT * FROM drivers WHERE id = ?")
    .bind(id)
    .first();

  if (!driver) {
    return c.json({ error: "Driver not found" }, 404);
  }

  return c.json(driver);
});

// Update driver location (authenticated)
app.post(
  "/api/driver/location",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    })
  ),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const db = c.env.DB;
    const { latitude, longitude } = c.req.valid("json");

    // Get driver by user_id
    const driver = await db
      .prepare("SELECT id FROM drivers WHERE user_id = ?")
      .bind(user.id)
      .first<{ id: number }>();

    if (!driver) {
      return c.json({ error: "Driver profile not found" }, 404);
    }

    // Update current location
    await db
      .prepare(
        `UPDATE drivers 
         SET current_latitude = ?, current_longitude = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      )
      .bind(latitude, longitude, driver.id)
      .run();

    // Save to location history
    await db
      .prepare(
        `INSERT INTO location_history (driver_id, latitude, longitude) 
         VALUES (?, ?, ?)`
      )
      .bind(driver.id, latitude, longitude)
      .run();

    return c.json({ success: true });
  }
);

// ============= ORDER ENDPOINTS =============

// Get all orders
app.get("/api/orders", async (c) => {
  const db = c.env.DB;
  const status = c.req.query("status");
  const driverId = c.req.query("driver_id");
  const date = c.req.query("date");

  let query = "SELECT * FROM orders WHERE 1=1";
  const params: any[] = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (driverId) {
    query += " AND driver_id = ?";
    params.push(driverId);
  }

  if (date) {
    query += " AND scheduled_date = ?";
    params.push(date);
  }

  query += " ORDER BY scheduled_date DESC, scheduled_time ASC";

  const stmt = db.prepare(query);
  const orders = await (params.length > 0 ? stmt.bind(...params) : stmt).all();

  return c.json(orders.results);
});

// Get orders for authenticated driver
app.get("/api/driver/orders", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = c.env.DB;

  // Get driver by user_id
  const driver = await db
    .prepare("SELECT id FROM drivers WHERE user_id = ?")
    .bind(user.id)
    .first<{ id: number }>();

  if (!driver) {
    return c.json({ error: "Driver profile not found" }, 404);
  }

  const orders = await db
    .prepare(
      `SELECT * FROM orders 
       WHERE driver_id = ? AND status != 'delivered' AND status != 'cancelled'
       ORDER BY scheduled_date ASC, scheduled_time ASC`
    )
    .bind(driver.id)
    .all();

  return c.json(orders.results);
});

// Get orders for a specific driver (for monitoring)
app.get("/api/drivers/:id/orders", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const orders = await db
    .prepare(
      `SELECT * FROM orders 
       WHERE driver_id = ? AND status != 'delivered'
       ORDER BY scheduled_date ASC, scheduled_time ASC`
    )
    .bind(id)
    .all();

  return c.json(orders.results);
});

// Create new order
app.post(
  "/api/orders",
  zValidator(
    "json",
    z.object({
      driver_id: z.number().optional(),
      customer_name: z.string(),
      customer_address: z.string(),
      customer_phone: z.string().optional(),
      delivery_latitude: z.number(),
      delivery_longitude: z.number(),
      notes: z.string().optional(),
      order_number: z.string(),
      scheduled_date: z.string().optional(),
      scheduled_time: z.string().optional(),
    })
  ),
  async (c) => {
    const db = c.env.DB;
    const data = c.req.valid("json");

    const result = await db
      .prepare(
        `INSERT INTO orders 
         (driver_id, customer_name, customer_address, customer_phone, 
          delivery_latitude, delivery_longitude, notes, order_number, 
          scheduled_date, scheduled_time, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(
        data.driver_id || null,
        data.customer_name,
        data.customer_address,
        data.customer_phone || null,
        data.delivery_latitude,
        data.delivery_longitude,
        data.notes || null,
        data.order_number,
        data.scheduled_date || null,
        data.scheduled_time || null
      )
      .run();

    return c.json({ id: result.meta.last_row_id, success: true });
  }
);

// Update order status
app.patch(
  "/api/orders/:id/status",
  zValidator(
    "json",
    z.object({
      status: z.enum(["pending", "assigned", "in_transit", "delivered", "cancelled"]),
    })
  ),
  async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const { status } = c.req.valid("json");

    await db
      .prepare(
        `UPDATE orders 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      )
      .bind(status, id)
      .run();

    return c.json({ success: true });
  }
);

// Assign order to driver
app.patch(
  "/api/orders/:id/assign",
  zValidator(
    "json",
    z.object({
      driver_id: z.number(),
    })
  ),
  async (c) => {
    const db = c.env.DB;
    const id = c.req.param("id");
    const { driver_id } = c.req.valid("json");

    await db
      .prepare(
        `UPDATE orders 
         SET driver_id = ?, status = 'assigned', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      )
      .bind(driver_id, id)
      .run();

    return c.json({ success: true });
  }
);

// Get location history for a driver
app.get("/api/drivers/:id/history", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const limit = c.req.query("limit") || "100";

  const history = await db
    .prepare(
      `SELECT latitude, longitude, created_at 
       FROM location_history 
       WHERE driver_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`
    )
    .bind(id, limit)
    .all();

  return c.json(history.results);
});

export default app;
