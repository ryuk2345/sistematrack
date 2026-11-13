import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import { Shield, Bike, Lock, User, Eye, EyeOff, X, ArrowRight, AlertCircle, KeyRound } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: "admin" | "driver";
}

export default function LoginModal({ isOpen, onClose, defaultRole = "admin" }: LoginModalProps) {
  const { login, redirectToGoogleLogin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"admin" | "driver">(defaultRole);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleFillCredentials = (type: "admin" | "driver") => {
    setError(null);
    if (type === "admin") {
      setActiveTab("admin");
      setUsername("admin");
      setPassword("admin123");
    } else {
      setActiveTab("driver");
      setUsername("motorizado1");
      setPassword("1234");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Por favor completa todos los campos");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await login(username, password);
    setIsLoading(false);

    if (result.success && result.user) {
      onClose();
      if (result.user.role === "admin") {
        navigate("/monitor");
      } else {
        navigate("/driver");
      }
    } else {
      setError(result.error || "Usuario o clave incorrectos");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800 text-center">
          <div className="inline-flex p-3 rounded-xl bg-blue-500/10 text-blue-400 mb-3 border border-blue-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Iniciar Sesión</h2>
          <p className="text-sm text-slate-400 mt-1">
            Sistema de Monitoreo y Gestión Logística
          </p>
        </div>

        {/* Role Tabs */}
        <div className="grid grid-cols-2 p-2 mx-6 mt-4 bg-slate-800/80 rounded-xl border border-slate-700/50">
          <button
            type="button"
            onClick={() => {
              setActiveTab("admin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === "admin"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Shield className="w-4 h-4" />
            Administrador
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("driver");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === "driver"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Bike className="w-4 h-4" />
            Motorizado
          </button>
        </div>

        {/* Quick autofill helper */}
        <div className="px-6 pt-3 flex items-center justify-between text-xs text-slate-400">
          <span>¿Credenciales de prueba?</span>
          <button
            type="button"
            onClick={() => handleFillCredentials(activeTab)}
            className="text-blue-400 hover:text-blue-300 font-medium underline flex items-center gap-1"
          >
            <KeyRound className="w-3 h-3" />
            {activeTab === "admin" ? "Cargar 'admin / admin123'" : "Cargar 'motorizado1 / 1234'"}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {activeTab === "admin" ? "Usuario de Administrador" : "Usuario o Teléfono del Chofer"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={activeTab === "admin" ? "admin" : "motorizado1 o 987654321"}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {activeTab === "admin" ? "Contraseña" : "PIN o Contraseña"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={activeTab === "admin" ? "admin123" : "1234"}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              activeTab === "admin"
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
            } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Ingresar como {activeTab === "admin" ? "Administrador" : "Motorizado"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Google OAuth Section (Preserved for future use) */}
          <div className="pt-2">
            <div className="relative flex items-center justify-center mb-3">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider">
                O continuar con
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            <button
              type="button"
              onClick={redirectToGoogleLogin}
              className="w-full py-2.5 px-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google (OAuth)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

