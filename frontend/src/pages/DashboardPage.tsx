import { usePrestamos } from "../hooks/usePrestamos";
import { useClientes } from "../hooks/useClientes";
import { useAuth } from "../hooks/useAuth";
import type { EstadoPrestamo, Prestamo } from "../types";

// ✦ Estados en MAYÚSCULA — igual que la BD y types.ts
const ESTADO_CONFIG: Record<EstadoPrestamo, { label: string; color: string; bg: string }> = {
  ACTIVO:    { label: "Activos",    color: "var(--brand)",   bg: "var(--brand-light)" },
  PAGADO:    { label: "Pagados",    color: "var(--success)", bg: "var(--success-bg)"  },
  MOROSO:    { label: "Morosos",    color: "var(--danger)",  bg: "var(--danger-bg)"   },
  PENDIENTE: { label: "Pendientes", color: "var(--warning)", bg: "var(--warning-bg)"  },
  APROBADO:  { label: "Aprobados",  color: "var(--info)",    bg: "var(--info-bg)"     },
  CANCELADO: { label: "Cancelados", color: "var(--text-3)",  bg: "var(--surface-2)"   },
};

function fmt(n: number) {
  return n.toLocaleString("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 });
}

function calcGanancia(p: Prestamo) {
  return (Number(p.cuota_mensual) * Number(p.plazo_meses)) - Number(p.capital);
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) return (
    <div style={{ width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "0.8rem" }}>
      Sin datos
    </div>
  );

  let cumAngle = -Math.PI / 2;
  const cx = 70, cy = 70, r = 60;

  const slices = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z` };
  });

  return (
    <svg viewBox="0 0 140 140" width="140" height="140" style={{ flexShrink: 0 }}>
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={34} fill="var(--surface)" />
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fill="var(--text-3)" fontFamily="inherit">Total</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--text-1)" fontFamily="inherit">{total}</text>
    </svg>
  );
}

export function DashboardPage() {
  const { prestamos, loading } = usePrestamos();
  const { clientes } = useClientes();
  const { usuario } = useAuth();

  // ── Conteos por estado
  const porEstado = (Object.keys(ESTADO_CONFIG) as EstadoPrestamo[]).map((est) => ({
    est,
    count:   prestamos.filter((p) => p.estado === est).length,
    capital: prestamos.filter((p) => p.estado === est).reduce((a, p) => a + Number(p.capital), 0),
  }));

  // ── Activos
  const activos       = prestamos.filter((p) => p.estado === "ACTIVO");
  const capitalActivo = activos.reduce((a, p) => a + Number(p.capital), 0);
  const cuotasMes     = activos.reduce((a, p) => a + Number(p.cuota_mensual), 0);

  // ── Monto restante total (de todos los préstamos no pagados)
  const montoRestanteTotal = prestamos
    .filter((p) => p.estado !== "PAGADO")
    .reduce((a, p) => a + Number(p.monto_restante ?? p.capital), 0);

  // ── Ganancias proyectadas
  const gananciaTotalProyectada = prestamos
    .filter((p) => p.estado === "ACTIVO" || p.estado === "PAGADO")
    .reduce((a, p) => a + calcGanancia(p), 0);

  const gananciaPagados = prestamos
    .filter((p) => p.estado === "PAGADO")
    .reduce((a, p) => a + calcGanancia(p), 0);

  const gananciaActivos = activos.reduce((a, p) => a + calcGanancia(p), 0);

  const capitalMorosos = prestamos
    .filter((p) => p.estado === "MOROSO")
    .reduce((a, p) => a + Number(p.capital), 0);

  // ── Pie data (solo estados con préstamos)
  const pieData = (Object.keys(ESTADO_CONFIG) as EstadoPrestamo[])
    .map((est) => ({
      label: ESTADO_CONFIG[est].label,
      value: prestamos.filter((p) => p.estado === est).length,
      color: ESTADO_CONFIG[est].color,
    }))
    .filter((d) => d.value > 0);

  return (
    <>
      {/* ── Topbar */}
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <span className="topbar-title">Dashboard</span>
          {usuario?.empresaNombre && (
            <span style={{
              fontSize: "0.78rem", fontWeight: 600,
              color: "var(--brand)", background: "var(--brand-light)",
              borderRadius: "99px", padding: "2px 10px",
            }}>
              🏢 {usuario.empresaNombre}
            </span>
          )}
        </div>
        <span className="text-sm text-muted" style={{ whiteSpace: "nowrap" }}>
          {new Date().toLocaleDateString("es-DO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="page">
        {loading && (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
            Cargando datos...
          </div>
        )}

        {!loading && (
          <>
            {/* ── Fila 1: métricas globales
                stats-grid ya maneja el responsive vía CSS externo;
                el fallback inline garantiza colapso si la clase no lo hace */}
            <div
              className="stats-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <div className="stat-card">
                <p className="stat-label">Total préstamos</p>
                <p className="stat-value">{prestamos.length}</p>
                <p className="stat-sub">{clientes.length} clientes registrados</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Capital en cartera</p>
                <p className="stat-value" style={{ fontSize: "1.35rem" }}>{fmt(capitalActivo)}</p>
                <p className="stat-sub">{activos.length} préstamos activos</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Ingresos / mes</p>
                <p className="stat-value" style={{ fontSize: "1.35rem", color: "var(--brand)" }}>{fmt(cuotasMes)}</p>
                <p className="stat-sub">Cuotas de préstamos activos</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Por cobrar</p>
                <p className="stat-value" style={{ fontSize: "1.35rem", color: "var(--danger)" }}>{fmt(montoRestanteTotal)}</p>
                <p className="stat-sub">Saldo pendiente total</p>
              </div>
            </div>

            {/* ── Fila 2: distribución + ganancias
                auto-fit: en ≥900px quedan lado a lado; en móvil se apilan */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
              gap: "1.5rem",
              marginBottom: "1.5rem",
            }}>

              {/* Distribución por estado */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Distribución por estado</span>
                </div>
                <div className="card-body">
                  {/* En pantallas pequeñas el pie se mueve arriba de la leyenda */}
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "1.5rem",
                  }}>
                    <PieChart data={pieData} />
                    <div style={{ flex: "1 1 160px", display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
                      {porEstado.map(({ est, count }) => {
                        const cfg = ESTADO_CONFIG[est];
                        const pct = prestamos.length ? Math.round((count / prestamos.length) * 100) : 0;
                        return (
                          <div key={est}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "4px" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color, flexShrink: 0, display: "inline-block" }} />
                                {cfg.label}
                              </span>
                              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                {count} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({pct}%)</span>
                              </span>
                            </div>
                            <div style={{ height: "4px", background: "var(--surface-2)", borderRadius: "99px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: cfg.color, borderRadius: "99px" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ganancias proyectadas */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Ganancias proyectadas</span>
                  <span className="badge badge-info">Intereses totales</span>
                </div>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{
                    background: "var(--brand-light)",
                    border: "1px solid #c3d7fc",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                  }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "0.3rem" }}>
                      Ganancia total proyectada
                    </p>
                    <p style={{ fontSize: "clamp(1.25rem, 4vw, 1.75rem)", fontWeight: 700, color: "var(--brand)" }}>
                      {fmt(gananciaTotalProyectada)}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--brand)", opacity: 0.7, marginTop: "2px" }}>
                      Activos + pagados
                    </p>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "10px",
                  }}>
                    <div style={{ background: "var(--success-bg)", borderRadius: "var(--radius-md)", padding: "0.75rem" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--success)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: "0.25rem" }}>
                        Cobrado (pagados)
                      </p>
                      <p style={{ fontSize: "clamp(0.95rem, 3vw, 1.1rem)", fontWeight: 700, color: "var(--success)" }}>{fmt(gananciaPagados)}</p>
                    </div>
                    <div style={{ background: "var(--brand-light)", borderRadius: "var(--radius-md)", padding: "0.75rem" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: "0.25rem" }}>
                        Por cobrar (activos)
                      </p>
                      <p style={{ fontSize: "clamp(0.95rem, 3vw, 1.1rem)", fontWeight: 700, color: "var(--brand)" }}>{fmt(gananciaActivos)}</p>
                    </div>
                  </div>

                  {capitalMorosos > 0 && (
                    <div style={{
                      background: "var(--danger-bg)",
                      border: "1px solid #fecaca",
                      borderRadius: "var(--radius-md)",
                      padding: "0.75rem",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}>
                      <div>
                        <p style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--danger)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                          Capital en riesgo (morosos)
                        </p>
                        <p style={{ fontSize: "clamp(0.95rem, 3vw, 1.1rem)", fontWeight: 700, color: "var(--danger)", marginTop: "2px" }}>{fmt(capitalMorosos)}</p>
                      </div>
                      <span className="badge badge-danger">
                        {prestamos.filter((p) => p.estado === "MOROSO").length} préstamos
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Fila 3: tabla resumen por estado
                overflow-x permite scroll horizontal en pantallas pequeñas */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Resumen por estado</span>
              </div>
              <div className="table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ minWidth: "540px" }}>
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Préstamos</th>
                      <th>Capital total</th>
                      <th>Ganancia proyectada</th>
                      <th>Cuota mensual total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porEstado.map(({ est, count, capital }) => {
                      const cfg     = ESTADO_CONFIG[est];
                      const grupo   = prestamos.filter((p) => p.estado === est);
                      const ganancia = grupo.reduce((a, p) => a + calcGanancia(p), 0);
                      const cuotas   = grupo.reduce((a, p) => a + Number(p.cuota_mensual), 0);
                      return (
                        <tr key={est}>
                          <td>
                            <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="font-medium">{count}</td>
                          <td>{capital > 0 ? fmt(capital) : "—"}</td>
                          <td style={{ color: ganancia > 0 ? "var(--success)" : "var(--text-3)", fontWeight: ganancia > 0 ? 600 : 400 }}>
                            {ganancia > 0 ? fmt(ganancia) : "—"}
                          </td>
                          <td style={{ color: "var(--brand)", fontWeight: cuotas > 0 ? 600 : 400 }}>
                            {cuotas > 0 ? fmt(cuotas) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}