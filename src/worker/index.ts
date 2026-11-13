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

// Resilient DB accessor: supports binding named "DB" or "base de datos"
const getDB = (env: any): D1Database => env.DB || env["base de datos"];

const LOCAL_SESSION_COOKIE = "sistematrack_session";

// SHA-256 password hash using standard Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password + "_sistematrack_salt_2025");
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Ensure auth tables exist and default credentials are seeded
async function ensureAuthTables(db: D1Database) {
  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'driver',
          pin TEXT,
          phone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `),
    ]);

    // Check if default admin exists
    const admin = await db.prepare("SELECT id FROM users WHERE username = 'admin'").first();
    if (!admin) {
      const adminPass = await hashPassword("admin123");
      await db
        .prepare(
          `INSERT INTO users (id, username, password_hash, name, role, phone)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind("user_admin_1", "admin", adminPass, "Administrador", "admin", "999999999")
        .run();
    }

    // Check if default test driver exists
    const driverUser = await db.prepare("SELECT id FROM users WHERE username = 'motorizado1'").first();
    if (!driverUser) {
      const driverPass = await hashPassword("1234");
      await db
        .prepare(
          `INSERT INTO users (id, username, password_hash, name, role, pin, phone)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind("user_driver_1", "motorizado1", driverPass, "Carlos Chofer", "driver", "1234", "987654321")
        .run();

      const existingDriver = await db
        .prepare("SELECT id FROM drivers WHERE user_id = 'user_driver_1'")
        .first();
      if (!existingDriver) {
        await db
          .prepare("INSERT INTO drivers (user_id, name, phone, is_active) VALUES (?, ?, ?, 1)")
          .bind("user_driver_1", "Carlos Chofer", "987654321")
          .run();
      }
    }
  } catch (err) {
    console.error("Error creating/verifying auth tables in D1:", err);
  }
}

const app = new Hono<{ Bindings: Env }>();

// Unified auth middleware: checks local credentials session first, falls back to Google/Mocha
const unifiedAuthMiddleware = async (c: any, next: any) => {
  const db = getDB(c.env);
  if (db) {
    await ensureAuthTables(db);
  }

  // 1. Check local session cookie or Authorization header
  const localToken = getCookie(c, LOCAL_SESSION_COOKIE) || c.req.header("Authorization")?.replace("Bearer ", "");
  if (localToken && db) {
    try {
      const session = await db
        .prepare(
          `SELECT s.token, u.id, u.username, u.name, u.role, u.phone, u.pin
           FROM sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
        )
        .bind(localToken)
        .first<any>();

      if (session) {
        c.set("user", {
          id: session.id,
          username: session.username,
          name: session.name,
          role: session.role,
          phone: session.phone,
        });
        return await next();
      }
    } catch (err) {
      console.error("Error verifying local session token:", err);
    }
  }

  // 2. Fall back to existing Mocha / Google OAuth
  if (c.env.MOCHA_USERS_SERVICE_API_URL && c.env.MOCHA_USERS_SERVICE_API_KEY) {
    try {
      return await authMiddleware(c, next);
    } catch (e) {
      console.error("Mocha authMiddleware error:", e);
    }
  }

  return c.json({ error: "Unauthorized" }, 401);
};

// ============= LOCAL AUTH ENDPOINTS =============

// Login with username and password / PIN
app.post(
  "/api/auth/login",
  zValidator(
    "json",
    z.object({
      username: z.string(),
      password: z.string(),
    })
  ),
  async (c) => {
    const db = getDB(c.env);
    if (!db) {
      return c.json({ error: "Base de datos D1 no conectada. Revisa el enlace D1 en Cloudflare." }, 500);
    }

    await ensureAuthTables(db);

    const { username, password } = c.req.valid("json");
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Find user by username or phone
    const user = await db
      .prepare("SELECT * FROM users WHERE LOWER(username) = ? OR phone = ?")
      .bind(cleanUsername, cleanUsername)
      .first<any>();

    if (!user) {
      return c.json({ error: "Usuario o clave incorrectos" }, 401);
    }

    const inputHash = await hashPassword(cleanPassword);
    const isValid = user.password_hash === inputHash || (user.pin && user.pin === cleanPassword);

    if (!isValid) {
      return c.json({ error: "Usuario o clave incorrectos" }, 401);
    }

    // Generate session token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db
      .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(token, user.id, expiresAt)
      .run();

    setCookie(c, LOCAL_SESSION_COOKIE, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 30 * 24 * 60 * 60,
    });

    // Ensure driver profile exists in drivers table if user is a driver
    if (user.role === "driver") {
      const existingDriver = await db
        .prepare("SELECT id FROM drivers WHERE user_id = ?")
        .bind(user.id)
        .first();

      if (!existingDriver) {
        await db
          .prepare("INSERT INTO drivers (user_id, name, phone, is_active) VALUES (?, ?, ?, 1)")
          .bind(user.id, user.name, user.phone || null)
          .run();
      }
    }

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
    });
  }
);

// Logout (local session)
app.post("/api/auth/logout", async (c) => {
  const token = getCookie(c, LOCAL_SESSION_COOKIE);
  const db = getDB(c.env);
  if (token && db) {
    try {
      await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    } catch (_) {}
  }

  setCookie(c, LOCAL_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true });
});

// Admin can create a new driver with username and PIN
app.post(
  "/api/auth/register-driver",
  unifiedAuthMiddleware,
  zValidator(
    "json",
    z.object({
      username: z.string().min(2),
      name: z.string().min(2),
      phone: z.string().optional(),
      pin: z.string().min(4),
    })
  ),
  async (c) => {
    const currentUser = c.get("user") as any;
    if (currentUser?.role !== "admin") {
      return c.json({ error: "Solo los administradores pueden registrar motorizados" }, 403);
    }

    const db = getDB(c.env);
    if (!db) return c.json({ error: "Base de datos no disponible" }, 500);

    const { username, name, phone, pin } = c.req.valid("json");
    const cleanUsername = username.trim().toLowerCase();

    // Check if username already exists
    const existing = await db
      .prepare("SELECT id FROM users WHERE LOWER(username) = ?")
      .bind(cleanUsername)
      .first();

    if (existing) {
      return c.json({ error: "El nombre de usuario ya está en uso" }, 400);
    }

    const userId = "driver_" + crypto.randomUUID().slice(0, 8);
    const passHash = await hashPassword(pin.trim());

    await db
      .prepare(
        `INSERT INTO users (id, username, password_hash, name, role, pin, phone)
         VALUES (?, ?, ?, ?, 'driver', ?, ?)`
      )
      .bind(userId, cleanUsername, passHash, name.trim(), pin.trim(), phone?.trim() || null)
      .run();

    await db
      .prepare("INSERT INTO drivers (user_id, name, phone, is_active) VALUES (?, ?, ?, 1)")
      .bind(userId, name.trim(), phone?.trim() || null)
      .run();

    return c.json({ success: true, userId });
  }
);

// ============= GOOGLE OAUTH / MOCHA ENDPOINTS (PRESERVED) =============

app.get("/api/oauth/google/redirect_url", async (c) => {
  if (!c.env.MOCHA_USERS_SERVICE_API_URL || !c.env.MOCHA_USERS_SERVICE_API_KEY) {
    return c.json(
      { error: "Google OAuth aún no está configurado en las variables de Cloudflare." },
      400
    );
  }

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

app.get("/api/users/me", unifiedAuthMiddleware, async (c) => {
  const user = c.get("user");
  const db = getDB(c.env);
  if (user && db) {
    const driver = await db
      .prepare("SELECT id FROM drivers WHERE user_id = ?")
      .bind(user.id)
      .first<any>();
    return c.json({
      ...user,
      driver_id: driver?.id || null,
    });
  }
  return c.json(user);
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string" && c.env.MOCHA_USERS_SERVICE_API_URL) {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    }).catch(() => {});
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
app.get("/api/driver/profile", unifiedAuthMiddleware, async (c) => {
  const user = c.get("user") as any;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDB(c.env);

  let driver = await db
    .prepare("SELECT * FROM drivers WHERE user_id = ?")
    .bind(user.id)
    .first();

  // If driver record not yet created for this user, auto-create it
  if (!driver && (user.role === "driver" || user.name)) {
    await db
      .prepare("INSERT INTO drivers (user_id, name, phone, is_active) VALUES (?, ?, ?, 1)")
      .bind(user.id, user.name || "Motorizado", user.phone || null)
      .run();

    driver = await db
      .prepare("SELECT * FROM drivers WHERE user_id = ?")
      .bind(user.id)
      .first();
  }

  if (!driver) {
    return c.json({ error: "Driver profile not found" }, 404);
  }

  return c.json(driver);
});

// Create or update driver profile for authenticated user
app.post(
  "/api/driver/profile",
  unifiedAuthMiddleware,
  zValidator(
    "json",
    z.object({
      name: z.string(),
      phone: z.string().optional(),
    })
  ),
  async (c) => {
    const user = c.get("user") as any;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const db = getDB(c.env);
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
  const db = getDB(c.env);
  if (!db) return c.json([]);
  await ensureAuthTables(db);

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
  const db = getDB(c.env);
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
  unifiedAuthMiddleware,
  zValidator(
    "json",
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    })
  ),
  async (c) => {
    const user = c.get("user") as any;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const db = getDB(c.env);
    const { latitude, longitude } = c.req.valid("json");

    // Get driver by user_id
    let driver = await db
      .prepare("SELECT id FROM drivers WHERE user_id = ?")
      .bind(user.id)
      .first<{ id: number }>();

    // Auto-create driver record if missing
    if (!driver) {
      const res = await db
        .prepare("INSERT INTO drivers (user_id, name, phone, is_active) VALUES (?, ?, ?, 1)")
        .bind(user.id, user.name || "Motorizado", user.phone || null)
        .run();
      driver = { id: res.meta.last_row_id as number };
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
  const db = getDB(c.env);
  if (!db) return c.json([]);
  await ensureAuthTables(db);

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
app.get("/api/driver/orders", unifiedAuthMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDB(c.env);

  // Get driver by user_id
  const driver = await db
    .prepare("SELECT id FROM drivers WHERE user_id = ?")
    .bind(user.id)
    .first<{ id: number }>();

  if (!driver) {
    return c.json([]);
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
  const db = getDB(c.env);
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
    const db = getDB(c.env);
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
    const db = getDB(c.env);
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
    const db = getDB(c.env);
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
  const db = getDB(c.env);
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
