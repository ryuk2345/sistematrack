import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@getmocha/users-service/react";
import HomePage from "@/react-app/pages/Home";
import MonitoringDashboard from "@/react-app/pages/MonitoringDashboard";
import DriverView from "@/react-app/pages/DriverView";
import AuthCallback from "@/react-app/pages/AuthCallback";
import DriverSetup from "@/react-app/pages/DriverSetup";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/monitor" element={<MonitoringDashboard />} />
          <Route path="/driver" element={<DriverView />} />
          <Route path="/driver/setup" element={<DriverSetup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
