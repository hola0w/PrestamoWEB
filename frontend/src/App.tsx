import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";

import {
  ProtectedRoute,
  RequireModulo,
  RequireAdmin,
} from "./components/ProtectedRoute";
import { Sidebar }          from "./components/Sidebar";
import { LoginPage }        from "./pages/LoginPage";
import { DashboardPage }    from "./pages/DashboardPage";
import { ClientesPage }     from "./pages/ClientesPage";
import { PrestamosPage }    from "./pages/PrestamosPage";
import { CxCPage }          from "./pages/CxCpage";
import { RegistroPage }     from "./pages/RegistroPage";
// ReportesPage ahora exporta "export default function PanelReportes()",
// por eso el import debe ser default (sin llaves), no named export.
import ReportesPage         from "./pages/ReportesPage";
//import { SucursalPage }     from "./pages/SucursalPage";
import { SucursalPage } from "./pages/SucursalPage";
import { UsuarioToolPage }  from "./pages/UsuarioToolPage";
import { MenuReportes } from "./pages/MenuReportes";

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          {/* Redirige / → /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/clientes" element={
            <RequireModulo modulo="clientes"><ClientesPage /></RequireModulo>
          } />
          <Route path="/prestamos" element={
            <RequireModulo modulo="prestamos"><PrestamosPage /></RequireModulo>
          } />
          <Route path="/cxc" element={
            <RequireModulo modulo="cxc"><CxCPage /></RequireModulo>
          } />
          <Route path="/cobros" element={
            <RequireModulo modulo="cobros"><RegistroPage /></RequireModulo>
          } />
          <Route path="/reportes" element={
            //<RequireModulo modulo="reportes"><ReportesPage /></RequireModulo>
            <RequireModulo modulo="reportes"><MenuReportes /></RequireModulo>
          } />
          <Route path="/usuarios" element={
            <RequireAdmin><UsuarioToolPage /></RequireAdmin>
          } />
          <Route path="/sucursales" element={
  <RequireAdmin><SucursalPage /></RequireAdmin> // 👈 Cambiado a <SucursalesPage />
} />
         
 

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AppRoutes() {
  const { usuario } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={usuario ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}