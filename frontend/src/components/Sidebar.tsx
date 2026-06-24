import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth, MODULOS_INFO, type Modulo } from "../hooks/useAuth";

const NAV_ORDER: Modulo[] = [
  "dashboard",
  "prestamos",
  "clientes",
  "cxc",
  "cobros",
  "reportes",
  "sucursales",
  "usuarios",
];

const MODULO_ICONS: Record<Modulo, string> = {
  dashboard:  "ti-layout-dashboard",
  clientes:   "ti-users",
  prestamos:  "ti-credit-card",
  cxc:        "ti-clipboard-list",
  cobros:     "ti-cash",
  reportes:   "ti-chart-bar",
  sucursales: "ti-building-store",
  usuarios:   "ti-settings",
};

const SECCIONES: Partial<Record<Modulo, string>> = {
  dashboard:  "Principal",
  cxc:        "Operaciones",
  reportes:   "Análisis",
  sucursales: "Administración",
};

export function Sidebar() {
  const { usuario, puedeVer, esAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const itemsVisibles = NAV_ORDER.filter((m) =>
    m === "usuarios" || m === "sucursales" ? esAdmin : puedeVer(m)
  );

  return (
    <>
      {/* Botón hamburguesa, solo visible en mobile (controlado por CSS) */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Abrir menú"
      >
        <i className={`ti ${mobileOpen ? "ti-x" : "ti-menu-2"}`} aria-hidden="true" />
      </button>

      {/* Overlay para cerrar al tocar afuera */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div style={{
            width: "32px", height: "32px",
            borderRadius: "var(--radius-md)",
            background: "var(--brand-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <i className="ti ti-building-bank"
              style={{ fontSize: "18px", color: "var(--brand)" }}
              aria-hidden="true" />
          </div>
          <div>
            <div style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--brand)" }}>
              PréstamoWMPR
            </div>
            <div style={{ fontSize: ".68rem", color: "var(--text-3)", marginTop: "1px" }}>
              Sistema de gestión
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {itemsVisibles.map((modulo) => {
            const info    = MODULOS_INFO[modulo];
            const seccion = SECCIONES[modulo];
            return (
              <div key={modulo}>
                {seccion && (
                  <div style={{
                    fontSize: ".65rem", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: ".08em",
                    color: "var(--text-3)",
                    padding: ".75rem .5rem .3rem",
                  }}>
                    {seccion}
                  </div>
                )}
                <NavLink
                  to={info.ruta}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    ["sidebar-item", isActive ? "sidebar-item--active" : ""].join(" ").trim()
                  }
                >
                  <i className={`ti ${MODULO_ICONS[modulo]}`}
                    style={{ fontSize: "17px", flexShrink: 0 }}
                    aria-hidden="true" />
                  <span className="sidebar-item-label">{info.label}</span>
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: ".5rem .625rem" }}>
            <div className="avatar" style={{ width: "30px", height: "30px", fontSize: ".7rem", flexShrink: 0 }}>
              {(usuario?.nombre ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: ".8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {usuario?.nombre}
              </div>
              <div style={{ fontSize: ".68rem", color: "var(--text-3)" }}>
                {esAdmin ? "Administrador" : "Usuario estándar"}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              width: "100%", padding: ".45rem .625rem", marginTop: "4px",
              borderRadius: "var(--radius-md)", border: "none",
              background: "transparent", fontSize: ".8rem",
              color: "var(--text-2)", cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-bg)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
            }}
          >
            <i className="ti ti-logout" style={{ fontSize: "16px" }} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}