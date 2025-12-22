import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { Navigation, Clock, AlertCircle, TrendingUp } from "lucide-react";

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const currentLocationIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destinationIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface WazeStyleMapProps {
  currentLocation: [number, number] | null;
  destination: [number, number];
  onRouteCalculated?: (distance: number, duration: number) => void;
}

interface RouteInfo {
  distance: number;
  duration: number;
  coordinates: [number, number][];
}

function RoutingMachine({
  currentLocation,
  destination,
  onRouteCalculated,
}: {
  currentLocation: [number, number];
  destination: [number, number];
  onRouteCalculated?: (info: RouteInfo) => void;
}) {
  const map = useMap();
  const routingControlRef = useRef<L.Routing.Control | null>(null);
  const hasCalculatedRef = useRef(false);

  useEffect(() => {
    if (!map || !currentLocation || hasCalculatedRef.current) return;

    // Remove existing routing control safely
    if (routingControlRef.current) {
      try {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      } catch (error) {
        console.warn("Error removing routing control:", error);
      }
    }

    try {
      const routingControl = L.Routing.control({
        waypoints: [
          L.latLng(currentLocation[0], currentLocation[1]),
          L.latLng(destination[0], destination[1]),
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: "#3b82f6", opacity: 0, weight: 0 }], // Hide default line
          extendToWaypoints: true,
          missingRouteTolerance: 0,
        },
        show: false,
      } as any).addTo(map);

      routingControl.on("routesfound", (e) => {
        const routes = e.routes;
        const route = routes[0];
        if (route && onRouteCalculated) {
          const coordinates: [number, number][] = route.coordinates.map((coord: L.LatLng) => [
            coord.lat,
            coord.lng,
          ]);
          onRouteCalculated({
            distance: route.summary.totalDistance,
            duration: route.summary.totalTime,
            coordinates,
          });
          hasCalculatedRef.current = true;
        }
      });

      routingControlRef.current = routingControl;
    } catch (error) {
      console.warn("Error creating routing control:", error);
    }

    return () => {
      if (routingControlRef.current && map) {
        try {
          map.removeControl(routingControlRef.current);
          routingControlRef.current = null;
        } catch (error) {
          console.warn("Error cleaning up routing control:", error);
        }
      }
    };
  }, [map, currentLocation, destination, onRouteCalculated]);

  return null;
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    // Only set view once on mount
    map.setView(center, 15);
  }, []); // Empty deps - only run once

  return null;
}

export default function WazeStyleMap({ currentLocation, destination, onRouteCalculated }: WazeStyleMapProps) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const handleRouteCalculated = (info: RouteInfo) => {
    setRouteInfo(info);
    if (onRouteCalculated) {
      onRouteCalculated(info.distance, info.duration);
    }
  };

  const center = currentLocation || destination;

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        className="rounded-lg"
        zoomControl={true}
      >
        <MapController center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {currentLocation && (
          <>
            <Marker position={currentLocation} icon={currentLocationIcon} />
            <Marker position={destination} icon={destinationIcon} />
            
            {/* Custom route polyline with better styling */}
            {routeInfo && routeInfo.coordinates.length > 0 && (
              <>
                {/* Outer glow effect */}
                <Polyline
                  positions={routeInfo.coordinates}
                  pathOptions={{
                    color: "#93c5fd",
                    weight: 12,
                    opacity: 0.3,
                    lineJoin: "round",
                    lineCap: "round",
                  }}
                />
                {/* Main route line */}
                <Polyline
                  positions={routeInfo.coordinates}
                  pathOptions={{
                    color: "#3b82f6",
                    weight: 6,
                    opacity: 0.9,
                    lineJoin: "round",
                    lineCap: "round",
                  }}
                />
                {/* Inner highlight */}
                <Polyline
                  positions={routeInfo.coordinates}
                  pathOptions={{
                    color: "#60a5fa",
                    weight: 3,
                    opacity: 0.7,
                    lineJoin: "round",
                    lineCap: "round",
                  }}
                />
              </>
            )}

            <RoutingMachine
              currentLocation={currentLocation}
              destination={destination}
              onRouteCalculated={handleRouteCalculated}
            />
          </>
        )}

        {!currentLocation && <Marker position={destination} icon={destinationIcon} />}
      </MapContainer>

      {/* Waze-style overlay */}
      {currentLocation && routeInfo && (
        <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl p-5 pointer-events-auto backdrop-blur-sm bg-white/95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg">
                  <Navigation className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatDistance(routeInfo.distance)}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{formatDuration(routeInfo.duration)}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">ETA estimado</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-green-600">En ruta</span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                  <TrendingUp className="w-3 h-3" />
                  Mejor ruta activa
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!currentLocation && (
        <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl shadow-lg p-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <div className="font-semibold text-amber-900">Ubicación no disponible</div>
                <div className="text-sm text-amber-700">
                  Activa la ubicación para ver la navegación
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Street-level navigation hint */}
      {currentLocation && routeInfo && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] pointer-events-none">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-2xl p-5 text-white pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="bg-white/25 p-3 rounded-xl backdrop-blur-sm shadow-inner">
                <Navigation className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium opacity-90 mb-1">Indicaciones de Ruta</div>
                <div className="font-bold text-lg">Sigue la línea azul en el mapa</div>
                <div className="text-sm opacity-80 mt-1">
                  La ruta está optimizada para motocicletas
                </div>
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                <div className="text-2xl font-bold">{formatDistance(routeInfo.distance)}</div>
                <div className="text-xs opacity-80">restantes</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
