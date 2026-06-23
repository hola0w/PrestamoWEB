import { useState, useCallback, useEffect } from "react";
import { api } from "../services/api";

// ─── Utilidades ───────────────────────────────
function fmt(n: number) {
  return Number(n).toLocaleString("es-DO", {
    style: "currency", currency: "DOP", maximumFractionDigits: 0,
  });
}
function fmtFecha(f: string | null) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMes(f: string) {
  return new Date(f).toLocaleDateString("es-DO", { month: "long", year: "numeric" });
}

// ─── Tipos ────────────────────────────────────
type TabReporte = "cobros" | "prestamos" | "deuda" | "vencidas" | "ingresos" | "historial";

interface FiltroPeriodo { desde: string; hasta: string; }

interface ClienteOpc  { id: string; nombre: string; }
interface UsuarioOpc  { id: string; nombre: string; }
interface PrestamoOpc { id: string; label: string; }

const TAB_CONFIG: { key: TabReporte; label: string; icon: string }[] = [
  { key: "cobros",    label: "Cobros del período",        icon: "💰" },
  { key: "prestamos", label: "Préstamos por estado",       icon: "📋" },
  { key: "deuda",     label: "Clientes con más deuda",     icon: "👤" },
  { key: "vencidas",  label: "Cuotas vencidas",            icon: "⚠️" },
  { key: "ingresos",  label: "Ingresos vs capital",        icon: "📈" },
  { key: "historial", label: "Historial por préstamo",     icon: "🔍" },
];

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO:    "var(--success)",
  PENDIENTE: "var(--warning)",
  MOROSO:    "var(--danger)",
  PAGADO:    "var(--text-3)",
  INACTIVO:  "var(--text-3)",
};

// ─── Exportar CSV ─────────────────────────────
function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function imprimir() { window.print(); }

// ─── Hook: cargar catálogos de filtros ────────
function useCatalogos() {
  const [clientes,  setClientes]  = useState<ClienteOpc[]>([]);
  const [usuarios,  setUsuarios]  = useState<UsuarioOpc[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoOpc[]>([]);

  useEffect(() => {
    api.get<any[]>("/clientes").then(data =>
      setClientes(data.map((c: any) => ({
        id:     c.id,
        nombre: `${c.nombres} ${c.apellidos}`,
      })))
    ).catch(() => {});

    api.get<any[]>("/usuarios").then(data =>
      setUsuarios(data.map((u: any) => ({ id: u.id, nombre: u.nombre ?? u.username })))
    ).catch(() => {});

    api.get<any[]>("/reportes/prestamos-lista").then(data =>
      setPrestamos(data.map((p: any) => ({
        id:    p.id,
        label: `${p.cliente_nombre} — ${fmt(p.capital)} — ${p.estado} (${fmtFecha(p.fecha_inicio)})`,
      })))
    ).catch(() => {});
  }, []);

  return { clientes, usuarios, prestamos };
}

// ─── Componente FiltroFecha ───────────────────
function FiltroFecha({
  filtro, onChange, onBuscar, loading, children,
}: {
  filtro: FiltroPeriodo;
  onChange: (f: FiltroPeriodo) => void;
  onBuscar: () => void;
  loading: boolean;
  children?: React.ReactNode;
}) {
  const hoy  = new Date().toISOString().split("T")[0];
  const mes1 = hoy.slice(0, 7) + "-01";

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1.25rem" }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="desde">Desde</label>
        <input id="desde" title="Desde" className="form-input" type="date"
          value={filtro.desde} onChange={e => onChange({ ...filtro, desde: e.target.value })} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="hasta">Hasta</label>
        <input id="hasta" title="Hasta" className="form-input" type="date"
          value={filtro.hasta} onChange={e => onChange({ ...filtro, hasta: e.target.value })} />
      </div>
      {/* Accesos rápidos */}
      <div style={{ display: "flex", gap: "6px", alignSelf: "flex-end", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: hoy, hasta: hoy })}>Hoy</button>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const lun = new Date(); lun.setDate(lun.getDate() - lun.getDay() + 1);
          onChange({ desde: lun.toISOString().split("T")[0], hasta: hoy });
        }}>Esta semana</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: mes1, hasta: hoy })}>Este mes</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: "", hasta: "" })}>Todo</button>
      </div>
      {children}
      <button className="btn btn-primary" onClick={onBuscar} disabled={loading}>
        {loading ? "Cargando..." : "Generar reporte"}
      </button>
    </div>
  );
}

// ─── Selector genérico reutilizable ───────────
function SelectFiltro({
  id, label, value, onChange, options, placeholder = "— Todos —",
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void;
  options: { id: string; label?: string; nombre?: string }[];
  placeholder?: string;
}) {
  return (
    <div className="form-group" style={{ marginBottom: 0, minWidth: "180px", flex: "1 1 180px" }}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <select id={id} title={label} className="form-select"
        value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label ?? o.nombre}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Panel de filtros avanzados ───────────────
function PanelFiltrosAvanzados({
  clienteId,    onClienteChange,
  prestamoId,   onPrestamoChange,
  usuarioId,    onUsuarioChange,
  clientes, prestamos, usuarios,
  mostrarPrestamo,
}: {
  clienteId:  string; onClienteChange:  (v: string) => void;
  prestamoId: string; onPrestamoChange: (v: string) => void;
  usuarioId:  string; onUsuarioChange:  (v: string) => void;
  clientes:  ClienteOpc[];
  prestamos: PrestamoOpc[];
  usuarios:  UsuarioOpc[];
  mostrarPrestamo?: boolean;
}) {
  const hayFiltros = !!(clienteId || prestamoId || usuarioId);

  return (
    <div style={{
      background: "var(--bg-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      padding: "0.875rem 1rem",
      marginBottom: "1.25rem",
    }}>
      <div style={{
        display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end",
      }}>
        {/* Filtro cliente */}
        <SelectFiltro
          id="filtro-cliente" label="Cliente"
          value={clienteId} onChange={onClienteChange}
          options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
          placeholder="— Todos los clientes —"
        />

        {/* Filtro préstamo */}
        {mostrarPrestamo && (
          <SelectFiltro
            id="filtro-prestamo" label="No. Préstamo"
            value={prestamoId} onChange={onPrestamoChange}
            options={prestamos.map(p => ({ id: p.id, label: p.label }))}
            placeholder="— Todos los préstamos —"
          />
        )}

        {/* Filtro usuario que autorizó */}
        <SelectFiltro
          id="filtro-usuario" label="Autorizó préstamo"
          value={usuarioId} onChange={onUsuarioChange}
          options={usuarios.map(u => ({ id: u.id, label: u.nombre }))}
          placeholder="— Todos los usuarios —"
        />

        {/* Limpiar filtros avanzados */}
        {hayFiltros && (
          <div style={{ alignSelf: "flex-end" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onClienteChange("");
                onPrestamoChange("");
                onUsuarioChange("");
              }}
              style={{ color: "var(--danger)", whiteSpace: "nowrap" }}
            >
              ✕ Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Chips de filtros activos */}
      {hayFiltros && (
        <div style={{ marginTop: "0.625rem", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-3)", alignSelf: "center" }}>
            Filtros activos:
          </span>
          {clienteId && (
            <span style={chipStyle}>
              Cliente
              <button style={chipBtnStyle} onClick={() => onClienteChange("")}>✕</button>
            </span>
          )}
          {prestamoId && (
            <span style={chipStyle}>
              Préstamo seleccionado
              <button style={chipBtnStyle} onClick={() => onPrestamoChange("")}>✕</button>
            </span>
          )}
          {usuarioId && (
            <span style={chipStyle}>
              Usuario autorizó
              <button style={chipBtnStyle} onClick={() => onUsuarioChange("")}>✕</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "4px",
  background: "var(--brand-light)", color: "var(--brand)",
  border: "1px solid #c3d7fc", borderRadius: "99px",
  padding: "2px 8px", fontSize: "0.75rem", fontWeight: 500,
};
const chipBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--brand)", padding: "0 2px", fontSize: "0.7rem", lineHeight: 1,
};

// ══════════════════════════════════════════════
// REPORTE 1 — Cobros del período
// ══════════════════════════════════════════════
function ReporteCobros({ clientes, usuarios, prestamos }: {
  clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; prestamos: PrestamoOpc[];
}) {
  const [filtro,     setFiltro]     = useState<FiltroPeriodo>({ desde: "", hasta: "" });
  const [clienteId,  setClienteId]  = useState("");
  const [prestamoId, setPrestamoId] = useState("");
  const [usuarioId,  setUsuarioId]  = useState("");
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filtro.desde)  params.append("desde",      filtro.desde);
      if (filtro.hasta)  params.append("hasta",      filtro.hasta);
      if (clienteId)     params.append("clienteId",  clienteId);
      if (prestamoId)    params.append("prestamoId", prestamoId);
      if (usuarioId)     params.append("usuarioId",  usuarioId);
      setData(await api.get<any>(`/reportes/cobros?${params}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <FiltroFecha filtro={filtro} onChange={setFiltro} onBuscar={buscar} loading={loading} />
      <PanelFiltrosAvanzados
        clienteId={clienteId}   onClienteChange={setClienteId}
        prestamoId={prestamoId} onPrestamoChange={setPrestamoId}
        usuarioId={usuarioId}   onUsuarioChange={setUsuarioId}
        clientes={clientes} prestamos={prestamos} usuarios={usuarios}
        mostrarPrestamo
      />
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <>
          <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="stat-card"><p className="stat-label">Cuotas cobradas</p><p className="stat-value">{data.resumen.total_cobros}</p></div>
            <div className="stat-card"><p className="stat-label">Total cobrado</p><p className="stat-value" style={{ color: "var(--success)", fontSize: "1.1rem" }}>{fmt(data.resumen.total_cobrado)}</p></div>
            <div className="stat-card"><p className="stat-label">Préstamos cobrados</p><p className="stat-value" style={{ color: "var(--brand)" }}>{data.resumen.prestamos_cobrados}</p></div>
            <div className="stat-card"><p className="stat-label">Clientes cobrados</p><p className="stat-value" style={{ color: "var(--brand)" }}>{data.resumen.clientes_cobrados}</p></div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data.detalle, "cobros.csv")}>⬇ CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha pago</th><th>Cliente</th><th>Cuota #</th>
                  <th>Monto cobrado</th><th>Frecuencia</th><th>Fecha vencía</th>
                </tr>
              </thead>
              <tbody>
                {data.detalle.map((r: any) => (
                  <tr key={r.id}>
                    <td className="text-muted">{fmtFecha(r.fecha_pago)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="avatar" style={{ width: "28px", height: "28px", fontSize: "0.65rem" }}>
                          {r.cliente_nombre?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium">{r.cliente_nombre}</span>
                      </div>
                    </td>
                    <td className="text-muted">#{r.numero_cuota}</td>
                    <td style={{ fontWeight: 600, color: "var(--success)" }}>{fmt(r.monto_pagado)}</td>
                    <td className="text-muted">{r.tipo_plazo}</td>
                    <td className="text-muted">{fmtFecha(r.fecha_vence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// REPORTE 2 — Préstamos por estado
// ══════════════════════════════════════════════
function ReportePrestamos({ clientes, usuarios, prestamos }: {
  clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; prestamos: PrestamoOpc[];
}) {
  const [filtro,     setFiltro]     = useState<FiltroPeriodo>({ desde: "", hasta: "" });
  const [clienteId,  setClienteId]  = useState("");
  const [prestamoId, setPrestamoId] = useState("");
  const [usuarioId,  setUsuarioId]  = useState("");
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filtro.desde)  params.append("desde",      filtro.desde);
      if (filtro.hasta)  params.append("hasta",      filtro.hasta);
      if (clienteId)     params.append("clienteId",  clienteId);
      if (prestamoId)    params.append("prestamoId", prestamoId);
      if (usuarioId)     params.append("usuarioId",  usuarioId);
      setData(await api.get<any>(`/reportes/prestamos?${params}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <FiltroFecha filtro={filtro} onChange={setFiltro} onBuscar={buscar} loading={loading} />
      <PanelFiltrosAvanzados
        clienteId={clienteId}   onClienteChange={setClienteId}
        prestamoId={prestamoId} onPrestamoChange={setPrestamoId}
        usuarioId={usuarioId}   onUsuarioChange={setUsuarioId}
        clientes={clientes} prestamos={prestamos} usuarios={usuarios}
        mostrarPrestamo
      />
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {data.porEstado.map((e: any) => (
              <div key={e.estado} className="stat-card"
                style={{ flex: "1 1 160px", borderLeft: `3px solid ${ESTADO_COLOR[e.estado] ?? "var(--border)"}` }}>
                <p className="stat-label">{e.estado}</p>
                <p className="stat-value" style={{ color: ESTADO_COLOR[e.estado] }}>{e.cantidad}</p>
                <p className="stat-sub">{fmt(e.capital_total)}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data.detalle, "prestamos.csv")}>⬇ CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th><th>Capital</th><th>Tasa</th><th>Plazo</th>
                  <th>Frecuencia</th><th>Pagado</th><th>Restante</th>
                  <th>Autorizó</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.detalle.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.cliente_nombre}</td>
                    <td>{fmt(r.capital)}</td>
                    <td className="text-muted">{r.tasa_anual}%</td>
                    <td className="text-muted">{r.plazo_meses}m</td>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{r.tipo_plazo}</td>
                    <td style={{ color: "var(--success)" }}>{fmt(r.total_pagado)}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{fmt(r.monto_restante)}</td>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>
                      {r.usuario_aprueba ?? "—"}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: "transparent",
                        color: ESTADO_COLOR[r.estado] ?? "var(--text-3)",
                        border: `1px solid ${ESTADO_COLOR[r.estado] ?? "var(--border)"}`,
                      }}>
                        {r.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// REPORTE 3 — Clientes con más deuda
// ══════════════════════════════════════════════
function ReporteDeuda({ clientes, usuarios }: {
  clientes: ClienteOpc[]; usuarios: UsuarioOpc[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [data,      setData]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (clienteId) params.append("clienteId", clienteId);
      if (usuarioId) params.append("usuarioId", usuarioId);
      setData(await api.get<any[]>(`/reportes/clientes-deuda?${params}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      {/* Panel de filtros */}
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem",
      }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectFiltro
            id="filtro-cliente-deuda" label="Cliente"
            value={clienteId} onChange={setClienteId}
            options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
            placeholder="— Todos los clientes —"
          />
          <SelectFiltro
            id="filtro-usuario-deuda" label="Autorizó préstamo"
            value={usuarioId} onChange={setUsuarioId}
            options={usuarios.map(u => ({ id: u.id, label: u.nombre }))}
            placeholder="— Todos los usuarios —"
          />
          {(clienteId || usuarioId) && (
            <div style={{ alignSelf: "flex-end" }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setClienteId(""); setUsuarioId(""); }}
                style={{ color: "var(--danger)" }}>
                ✕ Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "1.25rem", display: "flex", gap: "8px" }}>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? "Cargando..." : "Generar reporte"}
        </button>
        {data.length > 0 && <>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data, "clientes-deuda.csv")}>⬇ CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
        </>}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Cliente</th><th>Teléfono</th><th>Préstamos</th>
                <th>Capital total</th><th>Total pagado</th><th>Deuda total</th><th>Morosos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r: any, i: number) => (
                <tr key={r.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="avatar" style={{ width: "28px", height: "28px", fontSize: "0.65rem" }}>
                        {r.nombre?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{r.nombre}</span>
                    </div>
                  </td>
                  <td className="text-muted" style={{ fontSize: "0.82rem" }}>{r.telefono1 ?? "—"}</td>
                  <td className="text-muted">{r.total_prestamos}</td>
                  <td>{fmt(r.capital_total)}</td>
                  <td style={{ color: "var(--success)" }}>{fmt(r.total_pagado)}</td>
                  <td style={{ fontWeight: 700, color: "var(--danger)" }}>{fmt(r.deuda_total)}</td>
                  <td>
                    {Number(r.prestamos_morosos) > 0
                      ? <span className="badge badge-danger">{r.prestamos_morosos}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// REPORTE 4 — Cuotas vencidas
// ══════════════════════════════════════════════
function ReporteVencidas({ clientes, usuarios }: {
  clientes: ClienteOpc[]; usuarios: UsuarioOpc[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (clienteId) params.append("clienteId", clienteId);
      if (usuarioId) params.append("usuarioId", usuarioId);
      setData(await api.get<any>(`/reportes/cuotas-vencidas?${params}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem",
      }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectFiltro
            id="filtro-cliente-venc" label="Cliente"
            value={clienteId} onChange={setClienteId}
            options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
            placeholder="— Todos los clientes —"
          />
          <SelectFiltro
            id="filtro-usuario-venc" label="Autorizó préstamo"
            value={usuarioId} onChange={setUsuarioId}
            options={usuarios.map(u => ({ id: u.id, label: u.nombre }))}
            placeholder="— Todos los usuarios —"
          />
          {(clienteId || usuarioId) && (
            <div style={{ alignSelf: "flex-end" }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setClienteId(""); setUsuarioId(""); }}
                style={{ color: "var(--danger)" }}>
                ✕ Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: "1.25rem", display: "flex", gap: "8px" }}>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? "Cargando..." : "Generar reporte"}
        </button>
        {data && <>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data.detalle, "cuotas-vencidas.csv")}>⬇ CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
        </>}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <>
          <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="stat-card"><p className="stat-label">Clientes en atraso</p><p className="stat-value" style={{ color: "var(--danger)" }}>{data.resumen.clientes_con_atraso}</p></div>
            <div className="stat-card"><p className="stat-label">Cuotas vencidas</p><p className="stat-value" style={{ color: "var(--danger)" }}>{data.resumen.total_cuotas_vencidas}</p></div>
            <div className="stat-card"><p className="stat-label">Monto vencido total</p><p className="stat-value" style={{ color: "var(--danger)", fontSize: "1.1rem" }}>{fmt(data.resumen.monto_total_vencido)}</p></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th><th>Teléfono</th><th>Cuotas vencidas</th>
                  <th>Monto vencido</th><th>Primera vencida</th><th>Máx. días atraso</th><th>Frecuencia</th>
                </tr>
              </thead>
              <tbody>
                {data.detalle.map((r: any) => (
                  <tr key={r.prestamo_id}
                    style={{ background: Number(r.max_dias_atraso) > 30 ? "var(--danger-bg)" : "inherit" }}>
                    <td className="font-medium">{r.cliente_nombre}</td>
                    <td className="text-muted" style={{ fontSize: "0.82rem" }}>
                      <div>{r.telefono1 ?? "—"}</div>
                      {r.telefono2 && <div>{r.telefono2}</div>}
                    </td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{r.cuotas_vencidas}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 700 }}>{fmt(r.monto_vencido)}</td>
                    <td className="text-muted">{fmtFecha(r.primera_vencida)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: Number(r.max_dias_atraso) > 30 ? "var(--danger)" : "var(--warning)" }}>
                        {r.max_dias_atraso}d
                      </span>
                    </td>
                    <td className="text-muted" style={{ fontSize: "0.8rem" }}>{r.tipo_plazo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// REPORTE 5 — Ingresos vs capital
// ══════════════════════════════════════════════
function ReporteIngresos({ clientes, usuarios }: {
  clientes: ClienteOpc[]; usuarios: UsuarioOpc[];
}) {
  const [filtro,    setFiltro]    = useState<FiltroPeriodo>({ desde: "", hasta: "" });
  const [clienteId, setClienteId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filtro.desde)  params.append("desde",     filtro.desde);
      if (filtro.hasta)  params.append("hasta",     filtro.hasta);
      if (clienteId)     params.append("clienteId", clienteId);
      if (usuarioId)     params.append("usuarioId", usuarioId);
      setData(await api.get<any>(`/reportes/ingresos?${params}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <FiltroFecha filtro={filtro} onChange={setFiltro} onBuscar={buscar} loading={loading} />
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem",
      }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectFiltro
            id="filtro-cliente-ing" label="Cliente"
            value={clienteId} onChange={setClienteId}
            options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
            placeholder="— Todos los clientes —"
          />
          <SelectFiltro
            id="filtro-usuario-ing" label="Autorizó préstamo"
            value={usuarioId} onChange={setUsuarioId}
            options={usuarios.map(u => ({ id: u.id, label: u.nombre }))}
            placeholder="— Todos los usuarios —"
          />
          {(clienteId || usuarioId) && (
            <div style={{ alignSelf: "flex-end" }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setClienteId(""); setUsuarioId(""); }}
                style={{ color: "var(--danger)" }}>
                ✕ Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <>
          <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="stat-card"><p className="stat-label">Capital prestado</p><p className="stat-value" style={{ fontSize: "1.1rem" }}>{fmt(data.totales.total_capital_prestado)}</p></div>
            <div className="stat-card"><p className="stat-label">Ganancia proyectada</p><p className="stat-value" style={{ color: "var(--brand)", fontSize: "1.1rem" }}>{fmt(data.totales.ganancia_total_proyectada)}</p></div>
            <div className="stat-card"><p className="stat-label">Total cobrado</p><p className="stat-value" style={{ color: "var(--success)", fontSize: "1.1rem" }}>{fmt(data.totales.total_cobrado)}</p></div>
            <div className="stat-card"><p className="stat-label">Cobrado en período</p><p className="stat-value" style={{ color: "var(--success)", fontSize: "1.1rem" }}>{fmt(data.totales.cobrado_periodo)}</p></div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data.porMes, "ingresos.csv")}>⬇ CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Mes</th><th>Cuotas cobradas</th><th>Cobrado en mes</th><th>Préstamos activos</th></tr></thead>
              <tbody>
                {data.porMes.map((r: any) => (
                  <tr key={r.mes}>
                    <td className="font-medium">{fmtMes(r.mes)}</td>
                    <td className="text-muted">{r.cuotas_cobradas}</td>
                    <td style={{ color: "var(--success)", fontWeight: 600 }}>{fmt(r.cobrado_en_mes)}</td>
                    <td className="text-muted">{r.prestamos_activos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// REPORTE 6 — Historial por préstamo
// ══════════════════════════════════════════════
function ReporteHistorial({ clientes, usuarios, prestamos }: {
  clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; prestamos: PrestamoOpc[];
}) {
  const [clienteId,  setClienteId]  = useState("");
  const [usuarioId,  setUsuarioId]  = useState("");
  const [prestamoId, setPrestamoId] = useState("");
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Filtrar lista de préstamos por cliente seleccionado
  const listaFiltrada = clienteId
    ? prestamos.filter(p => p.label.toLowerCase().includes(
        clientes.find(c => c.id === clienteId)?.nombre.toLowerCase() ?? ""
      ))
    : prestamos;

  const buscar = async () => {
    if (!prestamoId) return;
    setLoading(true); setError(null);
    try {
      setData(await api.get<any>(`/reportes/historial/${prestamoId}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      {/* Filtros */}
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem",
      }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectFiltro
            id="filtro-cliente-hist" label="Filtrar por cliente"
            value={clienteId} onChange={v => { setClienteId(v); setPrestamoId(""); }}
            options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
            placeholder="— Todos los clientes —"
          />
          <SelectFiltro
            id="filtro-usuario-hist" label="Autorizó préstamo"
            value={usuarioId} onChange={setUsuarioId}
            options={usuarios.map(u => ({ id: u.id, label: u.nombre }))}
            placeholder="— Todos los usuarios —"
          />
          {(clienteId || usuarioId) && (
            <div style={{ alignSelf: "flex-end" }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setClienteId(""); setUsuarioId(""); setPrestamoId(""); }}
                style={{ color: "var(--danger)" }}>
                ✕ Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selector de préstamo */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 300px" }}>
          <label className="form-label" htmlFor="prestamo-select">
            No. Préstamo {clienteId && <span style={{ color: "var(--brand)", fontSize: "0.75rem" }}>(filtrado por cliente)</span>}
          </label>
          <select id="prestamo-select" title="Préstamo" className="form-select"
            value={prestamoId} onChange={e => setPrestamoId(e.target.value)}>
            <option value="">— Seleccionar préstamo —</option>
            {listaFiltrada.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={buscar} disabled={loading || !prestamoId}>
          {loading ? "Cargando..." : "Ver historial"}
        </button>
        {data && <>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(data.cuotas, "historial-cuotas.csv")}>⬇ CSV cuotas</button>
          <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
        </>}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <>
          {/* Info del préstamo */}
          <div style={{
            background: "var(--bg-2)", borderRadius: "var(--radius-md)",
            padding: "1rem 1.25rem", marginBottom: "1.25rem",
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: "0.75rem", fontSize: "0.85rem",
          }}>
            <div><p className="stat-label">Cliente</p><p className="font-medium">{data.prestamo.cliente_nombre}</p></div>
            <div><p className="stat-label">Capital</p><p className="font-medium">{fmt(data.prestamo.capital)}</p></div>
            <div><p className="stat-label">Tasa anual</p><p className="font-medium">{data.prestamo.tasa_anual}%</p></div>
            <div><p className="stat-label">Plazo</p><p className="font-medium">{data.prestamo.plazo_meses} meses</p></div>
            <div><p className="stat-label">Frecuencia</p><p className="font-medium">{data.prestamo.tipo_plazo}</p></div>
            <div>
              <p className="stat-label">Estado</p>
              <p className="font-medium" style={{ color: ESTADO_COLOR[data.prestamo.estado] }}>
                {data.prestamo.estado}
              </p>
            </div>
          </div>

          {/* Resumen cuotas */}
          <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="stat-card"><p className="stat-label">Total cuotas</p><p className="stat-value">{data.resumen.total_cuotas}</p></div>
            <div className="stat-card"><p className="stat-label">Pagadas</p><p className="stat-value" style={{ color: "var(--success)" }}>{data.resumen.cuotas_pagadas}</p></div>
            <div className="stat-card"><p className="stat-label">Pendientes</p><p className="stat-value" style={{ color: "var(--warning)" }}>{data.resumen.cuotas_pendientes}</p></div>
            <div className="stat-card"><p className="stat-label">Vencidas</p><p className="stat-value" style={{ color: "var(--danger)" }}>{data.resumen.cuotas_vencidas}</p></div>
            <div className="stat-card"><p className="stat-label">Monto pagado</p><p className="stat-value" style={{ color: "var(--success)", fontSize: "1rem" }}>{fmt(data.resumen.monto_pagado)}</p></div>
            <div className="stat-card"><p className="stat-label">Monto pendiente</p><p className="stat-value" style={{ color: "var(--danger)", fontSize: "1rem" }}>{fmt(data.resumen.monto_pendiente)}</p></div>
          </div>

          {/* Tabla de cuotas */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Fecha vence</th><th>Monto cuota</th><th>Estado</th><th>Fecha pago</th></tr>
              </thead>
              <tbody>
                {data.cuotas.map((c: any) => {
                  const vencida = c.estado === "PENDIENTE" && Number(c.dias_atraso) > 0;
                  return (
                    <tr key={c.id} style={vencida ? { background: "var(--danger-bg)" } : {}}>
                      <td className="text-muted">#{c.numero_cuota}</td>
                      <td style={{ color: vencida ? "var(--danger)" : "var(--text-2)" }}>{fmtFecha(c.fecha_vence)}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(c.monto_cuota)}</td>
                      <td>
                        <span className="badge" style={{
                          background: c.estado === "PAGADO" ? "var(--success-bg)" : vencida ? "var(--danger-bg)" : "var(--warning-bg)",
                          color: c.estado === "PAGADO" ? "var(--success)" : vencida ? "var(--danger)" : "var(--warning)",
                        }}>
                          {c.estado === "PAGADO" ? "Pagado" : vencida ? "Vencida" : "Pendiente"}
                        </span>
                      </td>
                      <td className="text-muted">{fmtFecha(c.fecha_pago)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════
export function ReportesPage() {
  const [tab, setTab] = useState<TabReporte>("cobros");
  const { clientes, usuarios, prestamos } = useCatalogos();

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Reportes</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir página</button>
        </div>
      </div>

      <div className="page">
        {/* Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {TAB_CONFIG.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "8px 16px", borderRadius: "var(--radius-md)",
              border: "1px solid", cursor: "pointer", fontSize: "0.85rem",
              borderColor: tab === t.key ? "var(--brand)" : "var(--border)",
              background:  tab === t.key ? "var(--brand)" : "var(--surface)",
              color:       tab === t.key ? "#fff" : "var(--text-2)",
              fontWeight:  tab === t.key ? 600 : 400,
              display: "flex", alignItems: "center", gap: "6px",
              transition: "all 0.15s",
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1.25rem", color: "var(--text-1)" }}>
            {TAB_CONFIG.find(t => t.key === tab)?.icon}{" "}
            {TAB_CONFIG.find(t => t.key === tab)?.label}
          </h2>
          {tab === "cobros"    && <ReporteCobros    clientes={clientes} usuarios={usuarios} prestamos={prestamos} />}
          {tab === "prestamos" && <ReportePrestamos clientes={clientes} usuarios={usuarios} prestamos={prestamos} />}
          {tab === "deuda"     && <ReporteDeuda     clientes={clientes} usuarios={usuarios} />}
          {tab === "vencidas"  && <ReporteVencidas  clientes={clientes} usuarios={usuarios} />}
          {tab === "ingresos"  && <ReporteIngresos  clientes={clientes} usuarios={usuarios} />}
          {tab === "historial" && <ReporteHistorial clientes={clientes} usuarios={usuarios} prestamos={prestamos} />}
        </div>
      </div>
    </>
  );
}