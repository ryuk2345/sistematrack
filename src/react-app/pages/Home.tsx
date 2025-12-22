import { Link } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Monitor, Smartphone, MapPin, TrendingUp, LogIn, LogOut } from "lucide-react";

export default function HomePage() {
  const { user, redirectToLogin, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-end mb-4">
            {user ? (
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            ) : (
              <button
                onClick={redirectToLogin}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Iniciar Sesión
              </button>
            )}
          </div>
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">
            FleetTrack
          </h1>
          <p className="text-xl text-blue-200">
            Sistema de Monitoreo de Motorizados en Tiempo Real
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all">
            <div className="bg-blue-500/20 p-4 rounded-xl w-fit mb-4">
              <MapPin className="w-8 h-8 text-blue-200" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Seguimiento en Vivo</h3>
            <p className="text-blue-200">
              Monitorea la ubicación de tus motorizados en tiempo real sobre un mapa interactivo
              con calles reales de Lima.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all">
            <div className="bg-indigo-500/20 p-4 rounded-xl w-fit mb-4">
              <TrendingUp className="w-8 h-8 text-indigo-200" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Planificación de Rutas</h3>
            <p className="text-blue-200">
              Asigna pedidos, planifica rutas óptimas con horarios programados y visualiza el
              progreso de cada entrega en tiempo real.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all">
            <div className="bg-purple-500/20 p-4 rounded-xl w-fit mb-4">
              <Monitor className="w-8 h-8 text-purple-200" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Panel de Control</h3>
            <p className="text-blue-200">
              Gestiona todos tus motorizados y pedidos desde un dashboard centralizado con
              estadísticas en tiempo real y creación de pedidos.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all">
            <div className="bg-pink-500/20 p-4 rounded-xl w-fit mb-4">
              <Smartphone className="w-8 h-8 text-pink-200" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Perfiles de Motorizado</h3>
            <p className="text-blue-200">
              Cada motorizado tiene su propio perfil con acceso personalizado para ver sus rutas,
              entregas asignadas y horarios programados.
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/monitor"
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <Monitor className="w-5 h-5" />
            Panel de Monitoreo
            <span className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity"></span>
          </Link>

          {user ? (
            <Link
              to="/driver"
              className="group relative px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-xl font-semibold text-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Smartphone className="w-5 h-5" />
              Mi Vista de Motorizado
              <span className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-5 transition-opacity"></span>
            </Link>
          ) : (
            <button
              onClick={redirectToLogin}
              className="group relative px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-xl font-semibold text-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Smartphone className="w-5 h-5" />
              Acceso Motorizado
              <span className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-5 transition-opacity"></span>
            </button>
          )}
        </div>

        {/* Demo Info */}
        <div className="mt-16 text-center">
          <p className="text-blue-200 text-sm">
            {user ? (
              <>Has iniciado sesión como: {user.email}</>
            ) : (
              <>Inicia sesión con Google para acceder como motorizado</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
