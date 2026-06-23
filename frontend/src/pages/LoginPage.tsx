import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { IconBuildingBank, IconLock } from "../components/Icons";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:1000/api";

type DbStatus = "checking" | "online" | "offline";

export function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus>("checking");

  useEffect(() => {
    fetch(`${BASE_URL}/health`)
      .then((res) => res.json())
      .then((data) => setDbStatus(data.ok ? "online" : "offline"))
      .catch(() => setDbStatus("offline"));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const statusConfig: Record<DbStatus, { label: string; color: string; bg: string; dot: string }> = {
    checking: { label: "Verificando...", color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
    online:   { label: "Conectado",     color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
    offline:  { label: "Sin conexión",  color: "#991b1b", bg: "#fee2e2", dot: "#ef4444" },
  };

  const { label, color, bg, dot } = statusConfig[dbStatus];

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <IconBuildingBank size={26} />
          PréstamoWMPR
        </div>

        {/* ── Indicador de BD ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              color,
              background: bg,
              border: `1px solid ${dot}40`,
              borderRadius: "999px",
              padding: "0.2rem 0.65rem",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: dot,
                boxShadow: dbStatus === "online" ? `0 0 0 2px ${dot}40` : "none",
                animation: dbStatus === "checking" ? "pulse 1.2s infinite" : "none",
              }}
            />
            BD · {label}
          </span>
        </div>

        <h1 className="auth-title">Bienvenido de nuevo</h1>
        <p className="auth-sub">Ingresa tus credenciales para continuar</p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
            <IconLock size={15} />
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              className="form-input"
              name="username"
              placeholder="Tu nombre de usuario"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-input"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              marginTop: "0.5rem",
              padding: "0.65rem",
            }}
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>

      {/* Animación del punto pulsante */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}