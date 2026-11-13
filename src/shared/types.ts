export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  is_active: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  driver_id: number | null;
  customer_name: string;
  customer_address: string;
  customer_phone: string | null;
  delivery_latitude: number;
  delivery_longitude: number;
  status: "pending" | "assigned" | "in_transit" | "delivered" | "cancelled";
  notes: string | null;
  order_number: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationHistory {
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "driver";
  phone?: string | null;
  email?: string | null;
  driver_id?: number | null;
}

