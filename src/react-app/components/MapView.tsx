import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Custom marker icons
const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const deliveryIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapViewProps {
  drivers?: Array<{
    id: number;
    name: string;
    current_latitude: number | null;
    current_longitude: number | null;
  }>;
  orders?: Array<{
    id: number;
    customer_name: string;
    customer_address: string;
    delivery_latitude: number;
    delivery_longitude: number;
    status: string;
  }>;
  route?: Array<[number, number]>;
  center?: [number, number];
  zoom?: number;
}

function MapUpdater({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
}

export default function MapView({
  drivers = [],
  orders = [],
  route = [],
  center = [-12.0464, -77.0428], // Lima, Peru
  zoom = 13,
}: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      className="rounded-lg"
    >
      <MapUpdater center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Render drivers */}
      {drivers.map((driver) => {
        if (!driver.current_latitude || !driver.current_longitude) return null;
        return (
          <Marker
            key={`driver-${driver.id}`}
            position={[driver.current_latitude, driver.current_longitude]}
            icon={driverIcon}
          >
            <Popup>
              <div className="font-semibold">{driver.name}</div>
              <div className="text-sm text-gray-600">Motorizado</div>
            </Popup>
          </Marker>
        );
      })}

      {/* Render delivery points */}
      {orders.map((order) => (
        <Marker
          key={`order-${order.id}`}
          position={[order.delivery_latitude, order.delivery_longitude]}
          icon={deliveryIcon}
        >
          <Popup>
            <div className="font-semibold">{order.customer_name}</div>
            <div className="text-sm text-gray-600">{order.customer_address}</div>
            <div className="text-xs mt-1">
              <span
                className={`px-2 py-1 rounded ${
                  order.status === "delivered"
                    ? "bg-green-100 text-green-800"
                    : order.status === "in_transit"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {order.status}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Render route if provided */}
      {route.length > 0 && (
        <Polyline positions={route} color="#3b82f6" weight={4} opacity={0.7} />
      )}
    </MapContainer>
  );
}
