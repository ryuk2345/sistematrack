import { useState, useEffect } from "react";
import type { Order } from "@/shared/types";

export function useOrders(driverId?: number) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [driverId]);

  const fetchOrders = async () => {
    try {
      const url = driverId ? `/api/drivers/${driverId}/orders` : "/api/orders";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: Order["status"]) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update order");
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const assignOrder = async (orderId: number, driverId: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId }),
      });
      if (!response.ok) throw new Error("Failed to assign order");
      await fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return { orders, loading, error, refetch: fetchOrders, updateOrderStatus, assignOrder };
}
