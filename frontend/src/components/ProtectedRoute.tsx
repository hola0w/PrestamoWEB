// ================================================================
// frontend/src/components/ProtectedRoute.tsx
// Reemplaza tu ProtectedRoute.tsx existente
// ================================================================
import { Navigate } from "react-router-dom";
import { useAuth, type Modulo } from "../hooks/useAuth";

// ── Guard básico: requiere sesión activa ──────────────────────
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", color: "var(--text-3)", fontSize: "0.875rem" }}>
        Cargando sesión...
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── Guard por módulo: verifica permiso específico ─────────────
export function RequireModulo({
  modulo,
  children,
}: {
  modulo:   Modulo;
  children: React.ReactNode;
}) {
  const { puedeVer } = useAuth();
  if (!puedeVer(modulo)) {
    return (
      <div className="page" style={{ display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", minHeight: "60vh",
        textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
        <h2 style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "1.1rem" }}>
          Acceso restringido
        </h2>
        <p style={{ color: "var(--text-3)", fontSize: "0.875rem", maxWidth: "320px" }}>
          No tienes permiso para ver esta sección.<br />
          Contacta al administrador para solicitar acceso.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

// ── Guard exclusivo ADMIN ─────────────────────────────────────
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { esAdmin } = useAuth();
  if (!esAdmin) {
    return (
      <div className="page" style={{ display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", minHeight: "60vh",
        textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
        <h2 style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "1.1rem" }}>
          Solo administradores
        </h2>
        <p style={{ color: "var(--text-3)", fontSize: "0.875rem" }}>
          Esta sección es exclusiva para administradores del sistema.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}