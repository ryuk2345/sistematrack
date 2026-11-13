import { useState } from "react";
import { Link } from "react-router";
import { MapPin, Package, Truck, Clock, CheckCircle, Plus, Download, UserPlus, LogOut, ArrowLeft, Shield } from "lucide-react";
import MapView from "@/react-app/components/MapView";
import CreateOrderModal from "@/react-app/components/CreateOrderModal";
import RegisterDriverModal from "@/react-app/components/RegisterDriverModal";
import { useDrivers } from "@/react-app/hooks/useDrivers";
import { useOrders } from "@/react-app/hooks/useOrders";
import { useAuth } from "@/react-app/context/AuthContext";

export default function MonitoringDashboard() {
  const { user, logout } = useAuth();
  const { drivers, refetch: refetchDrivers } = useDrivers();
  const { orders, updateOrderStatus, assignOrder, refetch } = useOrders();
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRegisterDriverOpen, setIsRegisterDriverOpen] = useState(false);

  const activeDrivers = drivers.filter((d) => d.is_active);
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const inTransitOrders = orders.filter((o) => o.status === "in_transit");
  const deliveredToday = orders.filter((o) => o.status === "delivered");

  const driversWithLocation = activeDrivers.filter(
    (d) => d.current_latitude && d.current_longitude
  );

  const filteredOrders = selectedDriver
    ? orders.filter((o) => o.driver_id === selectedDriver)
    : orders;

  const downloadReport = () => {
    // Prepare CSV data
    const headers = [
      "Pedido",
      "Cliente",
      "Dirección",
      "Teléfono",
      "Motorizado",
      "Estado",
      "Fecha Programada",
      "Hora Programada",
      "Notas",
      "Fecha Creación",
    ];

    const rows = orders.map((order) => {
      const driver = drivers.find((d) => d.id === order.driver_id);
      return [
        order.order_number || "",
        order.customer_name,
        order.customer_address,
        order.customer_phone || "",
        driver?.name || "Sin asignar",
        order.status,
        order.scheduled_date || "",
        order.scheduled_time || "",
        order.notes || "",
        new Date(order.created_at).toLocaleString("es-PE"),
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte-entregas-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Volver al Inicio"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  FleetTrack
                </h1>
                <p className="text-xs text-gray-500">Panel de Monitoreo en Tiempo Real</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {user && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-100 mr-2">
                  <Shield className="w-3.5 h-3.5" />
                  {user.name} ({user.role})
                </span>
              )}
              <button
                onClick={() => setIsRegisterDriverOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Registrar Chofer
              </button>
              <button
                onClick={downloadReport}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4" />
                Reporte CSV
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Crear Pedido
              </button>
              {user && (
                <button
                  onClick={logout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Motorizados Activos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{activeDrivers.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Pedidos Pendientes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{pendingOrders.length}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">En Tránsito</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{inTransitOrders.length}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Entregados Hoy</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{deliveredToday.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-[600px]">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Mapa en Tiempo Real</h2>
              <div className="h-[calc(100%-2rem)]">
                <MapView drivers={driversWithLocation} orders={filteredOrders} />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Drivers List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Motorizados</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelectedDriver(null)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedDriver === null
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                  }`}
                >
                  <div className="font-medium text-gray-900">Todos</div>
                </button>
                {activeDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => setSelectedDriver(driver.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedDriver === driver.id
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{driver.name}</div>
                        <div className="text-sm text-gray-500">{driver.phone}</div>
                      </div>
                      {driver.current_latitude && driver.current_longitude && (
                        <MapPin className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pedidos</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{order.customer_name}</div>
                        <div className="text-sm text-gray-600">{order.order_number}</div>
                        {(order.scheduled_date || order.scheduled_time) && (
                          <div className="text-xs text-gray-500 mt-1">
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
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : order.status === "in_transit"
                              ? "bg-blue-100 text-blue-700"
                              : order.status === "assigned"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">{order.customer_address}</div>
                    {order.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <select
                          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                          onChange={(e) => {
                            const driverId = parseInt(e.target.value);
                            if (driverId) assignOrder(order.id, driverId);
                          }}
                        >
                          <option value="">Asignar a...</option>
                          {activeDrivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {order.status === "assigned" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "in_transit")}
                        className="w-full mt-2 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                      >
                        Iniciar Entrega
                      </button>
                    )}
                    {order.status === "in_transit" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "delivered")}
                        className="w-full mt-2 text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors"
                      >
                        Marcar Entregado
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refetch}
        drivers={activeDrivers}
      />

      <RegisterDriverModal
        isOpen={isRegisterDriverOpen}
        onClose={() => setIsRegisterDriverOpen(false)}
        onSuccess={() => {
          if (refetchDrivers) refetchDrivers();
        }}
      />
    </div>
  );
}
