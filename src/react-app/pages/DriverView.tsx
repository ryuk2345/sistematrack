import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Navigation, MapPin, Phone, CheckCircle, Package, LogOut, User, ExternalLink, Shield } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import WazeStyleMap from "@/react-app/components/WazeStyleMap";
import type { Driver, Order } from "@/shared/types";

export default function DriverView() {
  const { user, logout } = useAuth();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("sistematrack_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch driver profile
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/driver/profile", {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setDriver(data);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch driver's orders
  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/driver/orders", {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Get current location and send to server
  useEffect(() => {
    if (!user || !navigator.geolocation) return;

    const updateLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentLocation([lat, lng]);

          await fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    };

    updateLocation();
    const interval = setInterval(updateLocation, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const updateOrderStatus = async (orderId: number, status: Order["status"]) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        const updatedResponse = await fetch("/api/driver/orders");
        if (updatedResponse.ok) {
          const data = await updatedResponse.json();
          setOrders(data);
        }
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Acceso Restringido</h1>
          <p className="text-blue-200 mb-6">Debes iniciar sesión como motorizado para acceder a esta vista</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {user?.role === "admin" ? "Modo Administrador" : "Perfil de Motorizado"}
          </h2>
          <p className="text-gray-600 mb-6 text-sm">
            {user?.role === "admin"
              ? "Has iniciado sesión como Administrador. Tu función principal está en el Panel de Monitoreo."
              : "No se encontró un perfil de chofer activo vinculado a esta cuenta."}
          </p>

          <div className="space-y-3">
            <Link
              to="/monitor"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Shield className="w-4 h-4" />
              Ir al Panel de Monitoreo
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Reintentar Carga
            </button>
            <button
              onClick={logout}
              className="w-full inline-flex items-center justify-center px-6 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const nextOrder = activeOrders[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1>
              <p className="text-gray-600">Vista de Ruta</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline"
              >
                Inicio
              </Link>
              {user?.role === "admin" && (
                <Link
                  to="/monitor"
                  className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 font-medium rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Panel Monitoreo
                </Link>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{activeOrders.length} pendientes</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Next Delivery Card */}
        {nextOrder && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 mb-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm opacity-90 mb-1">Próxima Entrega</div>
                <div className="text-2xl font-bold">{nextOrder.customer_name}</div>
                <div className="text-sm opacity-90 mt-1">{nextOrder.order_number}</div>
                {(nextOrder.scheduled_date || nextOrder.scheduled_time) && (
                  <div className="text-xs opacity-75 mt-2">
                    {nextOrder.scheduled_date && (
                      <span>
                        {new Date(nextOrder.scheduled_date).toLocaleDateString("es-PE")}
                      </span>
                    )}
                    {nextOrder.scheduled_time && <span> {nextOrder.scheduled_time}</span>}
                  </div>
                )}
              </div>
              <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
                <Navigation className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-start gap-2 mb-4">
              <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">{nextOrder.customer_address}</div>
            </div>
            {nextOrder.customer_phone && (
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-5 h-5" />
                <a href={`tel:${nextOrder.customer_phone}`} className="text-sm underline">
                  {nextOrder.customer_phone}
                </a>
              </div>
            )}
            {nextOrder.notes && (
              <div className="text-sm opacity-90 mb-4 p-3 bg-white/10 rounded-lg">
                <strong>Notas:</strong> {nextOrder.notes}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${nextOrder.delivery_latitude},${nextOrder.delivery_longitude}&travelmode=motorcycling`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-md"
              >
                <Navigation className="w-5 h-5" />
                Abrir en Google Maps (Moto)
                <ExternalLink className="w-4 h-4" />
              </a>
              <div className="flex gap-3">
                {nextOrder.status === "assigned" && (
                  <button
                    onClick={() => updateOrderStatus(nextOrder.id, "in_transit")}
                    className="flex-1 bg-white text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Package className="w-5 h-5" />
                    Iniciar Entrega
                  </button>
                )}
                {nextOrder.status === "in_transit" && (
                  <button
                    onClick={() => updateOrderStatus(nextOrder.id, "delivered")}
                    className="flex-1 bg-white text-green-600 px-4 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Marcar Entregado
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map with Waze-style navigation */}
        {nextOrder && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Navegación GPS</h2>
            <div className="h-[500px] rounded-lg overflow-hidden">
              <WazeStyleMap
                currentLocation={currentLocation}
                destination={[nextOrder.delivery_latitude, nextOrder.delivery_longitude]}
              />
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lista de Entregas</h2>
          {activeOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tienes entregas asignadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((order, index) => (
                <div
                  key={order.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    index === 0 ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                          {index + 1}
                        </span>
                        <div className="font-semibold text-gray-900">{order.customer_name}</div>
                      </div>
                      <div className="text-sm text-gray-600 ml-8">{order.order_number}</div>
                      {(order.scheduled_date || order.scheduled_time) && (
                        <div className="text-xs text-gray-500 ml-8 mt-1">
                          {order.scheduled_date && (
                            <span>
                              {new Date(order.scheduled_date).toLocaleDateString("es-PE")}
                            </span>
                          )}
                          {order.scheduled_time && <span> {order.scheduled_time}</span>}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === "in_transit"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {order.status === "in_transit" ? "En camino" : "Asignado"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-600 ml-8">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>{order.customer_address}</div>
                  </div>
                  {order.customer_phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 ml-8 mt-1">
                      <Phone className="w-4 h-4" />
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {order.customer_phone}
                      </a>
                    </div>
                  )}
                  {order.notes && (
                    <div className="text-sm text-gray-600 ml-8 mt-2 p-2 bg-gray-100 rounded">
                      <strong>Notas:</strong> {order.notes}
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_latitude},${order.delivery_longitude}&travelmode=motorcycling`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full mt-2 text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Navegar en Google Maps
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
