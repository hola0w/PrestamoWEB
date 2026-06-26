import { useState, useCallback, useEffect, useMemo } from "react";
import { api } from "../services/api";

// ─── Utilidades de Formateo Blindadas ───────────────────────────────
function fmt(n: number | null | undefined) {
  // Evita el fallo de renderizado si viene un valor no numérico o nulo del backend
  const valor = n && !isNaN(Number(n)) ? Number(n) : 0;
  return valor.toLocaleString("es-DO", {
    style: "currency", currency: "DOP", maximumFractionDigits: 0,
  });
}

function fmtFecha(f: string | null) {
  if (!f) return "—";
  try {
    return new Date(f).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "Fecha inválida";
  }
}

// ─── Tipos ────────────────────────────────────
type TabReporte = "cobros" | "prestamos" | "deuda" | "vencidas";

interface FiltroPeriodo { desde: string; hasta: string; }
interface ClienteOpc  { id: string; nombre: string; }
interface UsuarioOpc  { id: string; nombre: string; }
interface PrestamoOpc { id: string; label: string; }

type FiltroId = "cliente" | "prestamo" | "usuario";

const TAB_CONFIG: { key: TabReporte; label: string; icon: string }[] = [
  { key: "cobros",    label: "Cobros del período",        icon: "💰" },
  { key: "prestamos", label: "Préstamos por estado",       icon: "📋" },
  { key: "deuda",     label: "Clientes con más deuda",     icon: "👤" },
  { key: "vencidas",  label: "Cuotas vencidas",            icon: "⚠️" },
];

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO:    "var(--success)",
  PENDIENTE: "var(--warning)",
  MOROSO:    "var(--danger)",
  PAGADO:    "var(--text-3)",
  INACTIVO:  "var(--text-3)",
};

// Normalizador de texto para búsquedas y comparaciones seguras
function normalizarTexto(txt: string): string {
  return String(txt ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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

// ─── Hook: Cargar catálogos de filtros ────────
function useCatalogos() {
  const [clientes,  setClientes]  = useState<ClienteOpc[]>([]);
  const [usuarios,  setUsuarios]  = useState<UsuarioOpc[]>([]);
  const [prestamos, setPrestamos] = useState<PrestamoOpc[]>([]);

  useEffect(() => {
    api.get<any[]>("/clientes").then(data => {
      if(Array.isArray(data)) {
        setClientes(data.map((c: any) => ({
          id:     c.id,
          nombre: `${c.nombres ?? ""} ${c.apellidos ?? ""}`.trim() || "Cliente sin nombre",
        })));
      }
    }).catch(() => {});

    api.get<any[]>("/usuarios").then(data => {
      if(Array.isArray(data)) {
        setUsuarios(data.map((u: any) => ({ id: u.id, nombre: u.nombre ?? u.username ?? "Usuario" })));
      }
    }).catch(() => {});

    api.get<any[]>("/reportes/prestamos-lista").then(data => {
      if(Array.isArray(data)) {
        setPrestamos(data.map((p: any) => ({
          id:    p.id,
          label: `${p.cliente_nombre ?? "S/N"} — ${fmt(p.capital)} — ${p.estado ?? ""} (${fmtFecha(p.fecha_inicio)})`,
        })));
      }
    }).catch(() => {});
  }, []);

  return { clientes, usuarios, prestamos };
}

// ─── Componentes de Filtros ───────────────────
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
        {loading ? "Procesando informe..." : "Generar reporte"}
      </button>
    </div>
  );
}

function SelectFiltro({
  id, label, value, onChange, options, placeholder = "— Todos —",
  disabled = false, disabledTitle,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void;
  options: { id: string; label?: string; nombre?: string }[];
  placeholder?: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <div className="form-group" style={{ marginBottom: 0, minWidth: "180px", flex: "1 1 180px" }}>
      <label className="form-label" htmlFor={id}>
        {label}
        {disabled && <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: "0.7rem" }}> (no disponible)</span>}
      </label>
      <select id={id} title={disabled ? disabledTitle : label} className="form-select"
        value={disabled ? "" : value} onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label ?? o.nombre}</option>
        ))}
      </select>
    </div>
  );
}

const MOTIVO_DESHABILITADO: Record<FiltroId, string> = {
  cliente:  "Este reporte no incluye un identificador de cliente para filtrar.",
  prestamo: "Este reporte no incluye un identificador de préstamo para filtrar.",
  usuario:  "El backend de reportes no asocia el usuario administrador en esta consulta específica.",
};

function PanelFiltrosAvanzados({
  clienteId,    onClienteChange,
  prestamoId,   onPrestamoChange,
  usuarioId,    onUsuarioChange,
  clientes, prestamos, usuarios,
  mostrarPrestamo,
  deshabilitados = [],
}: {
  clienteId:  string; onClienteChange:  (v: string) => void;
  prestamoId: string; onPrestamoChange: (v: string) => void;
  usuarioId:  string; onUsuarioChange:  (v: string) => void;
  clientes:   ClienteOpc[];
  prestamos:  PrestamoOpc[];
  usuarios:   UsuarioOpc[];
  mostrarPrestamo?: boolean;
  deshabilitados?: FiltroId[];
}) {
  const clienteDeshabilitado  = deshabilitados.includes("cliente");
  const prestamoDeshabilitado = deshabilitados.includes("prestamo");
  const usuarioDeshabilitado  = deshabilitados.includes("usuario");

  const hayFiltros = !!(
    (clienteId && !clienteDeshabilitado) ||
    (prestamoId && !prestamoDeshabilitado) ||
    (usuarioId && !usuarioDeshabilitado)
  );

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <SelectFiltro id="filtro-cliente" label="Cliente" value={clienteId} onChange={onClienteChange} options={clientes.map(c => ({ id: c.id, label: c.nombre }))} placeholder="— Todos los clientes —" disabled={clienteDeshabilitado} disabledTitle={MOTIVO_DESHABILITADO.cliente} />
        {mostrarPrestamo && (
          <SelectFiltro id="filtro-prestamo" label="No. Préstamo" value={prestamoId} onChange={onPrestamoChange} options={prestamos.map(p => ({ id: p.id, label: p.label }))} placeholder="— Todos los préstamos —" disabled={prestamoDeshabilitado} disabledTitle={MOTIVO_DESHABILITADO.prestamo} />
        )}
        <SelectFiltro id="filtro-usuario" label="Autorizó préstamo" value={usuarioId} onChange={onUsuarioChange} options={usuarios.map(u => ({ id: u.id, label: u.nombre }))} placeholder="— Todos los usuarios —" disabled={usuarioDeshabilitado} disabledTitle={MOTIVO_DESHABILITADO.usuario} />
        {hayFiltros && (
          <div style={{ alignSelf: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { onClienteChange(""); onPrestamoChange(""); onUsuarioChange(""); }} style={{ color: "var(--danger)", whiteSpace: "nowrap" }}>✕ Limpiar filtros</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// REPORTE 1 — Cobros del período
// ══════════════════════════════════════════════
function ReporteCobros({ clientes, usuarios, prestamos }: { clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; prestamos: PrestamoOpc[]; }) {
  const [filtro, setFiltro] = useState<FiltroPeriodo>({ desde: "", hasta: "" });
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filtro.desde) params.append("desde", filtro.desde);
      if (filtro.hasta) params.append("hasta", filtro.hasta);
      const res = await api.get<any>(`/reportes/cobros?${params}`);
      setData(res);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  const detalleFiltrado = useMemo(() => {
    if (!data || !data.detalle) return [];
    if (!clienteSeleccionado) return data.detalle;
    // Comparación segura e inmune a espacios o minúsculas accidentales
    return data.detalle.filter((r: any) => normalizarTexto(r.cliente_nombre) === normalizarTexto(clienteSeleccionado.nombre));
  }, [data, clienteSeleccionado]);

  const resumenFiltrado = useMemo(() => {
    if (!data) return null;
    if (!clienteSeleccionado) return data.resumen;
    let totalCobrado = 0;
    detalleFiltrado.forEach((r: any) => { totalCobrado += Number(r.monto_pagado || 0); });
    return {
      total_cobros:       detalleFiltrado.length,
      total_cobrado:      totalCobrado,
      prestamos_cobrados: "Filtrado",
      clientes_cobrados:  1,
    };
  }, [data, detalleFiltrado, clienteSeleccionado]);

  return (
    <div>
      <FiltroFecha filtro={filtro} onChange={setFiltro} onBuscar={buscar} loading={loading} />
      <PanelFiltrosAvanzados clienteId={clienteId} onClienteChange={setClienteId} prestamoId="" onPrestamoChange={() => {}} usuarioId="" onUsuarioChange={() => {}} clientes={clientes} prestamos={prestamos} usuarios={usuarios} deshabilitados={["prestamo", "usuario"]} />
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div style={{ color: "var(--brand)", fontSize: "0.85rem", marginBottom: "1rem" }}>💡 Tip: Si el reporte tarda, Render está encendiendo los contenedores...</div>}
      {data && resumenFiltrado && (
        <>
          <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="stat-card"><p className="stat-label">Cuotas cobradas</p><p className="stat-value">{resumenFiltrado.total_cobros}</p></div>
            <div className="stat-card"><p className="stat-label">Total cobrado</p><p className="stat-value" style={{ color: "var(--success)" }}>{fmt(resumenFiltrado.total_cobrado)}</p></div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(detalleFiltrado, "cobros.csv")}>⬇ CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha pago</th><th>Cliente</th><th>Monto cobrado</th><th>Fecha vencía</th></tr>
              </thead>
              <tbody>
                {detalleFiltrado.map((r: any, i: number) => (
                  <tr key={r.id || i}>
                    <td className="text-muted">{fmtFecha(r.fecha_pago)}</td>
                    <td className="font-medium">{r.cliente_nombre}</td>
                    <td style={{ fontWeight: 600, color: "var(--success)" }}>{fmt(r.monto_pagado)}</td>
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
function ReportePrestamos({ clientes, usuarios, prestamos }: { clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; prestamos: PrestamoOpc[]; }) {
  const [filtro, setFiltro] = useState<FiltroPeriodo>({ desde: "", hasta: "" });
  const [clienteId, setClienteId] = useState("");
  const [prestamoId, setPrestamoId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filtro.desde) params.append("desde", filtro.desde);
      if (filtro.hasta) params.append("hasta", filtro.hasta);
      setData(await api.get<any>(`/reportes/prestamos?${params}`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  const detalleFiltrado = useMemo(() => {
    if (!data || !data.detalle) return [];
    let rows = data.detalle;
    if (clienteSeleccionado) rows = rows.filter((r: any) => normalizarTexto(r.cliente_nombre) === normalizarTexto(clienteSeleccionado.nombre));
    if (prestamoId)          rows = rows.filter((r: any) => r.id === prestamoId);
    return rows;
  }, [data, clienteSeleccionado, prestamoId]);

  return (
    <div>
      <FiltroFecha filtro={filtro} onChange={setFiltro} onBuscar={buscar} loading={loading} />
      <PanelFiltrosAvanzados clienteId={clienteId} onClienteChange={setClienteId} prestamoId={prestamoId} onPrestamoChange={setPrestamoId} usuarioId="" onUsuarioChange={() => {}} clientes={clientes} prestamos={prestamos} usuarios={usuarios} mostrarPrestamo deshabilitados={["usuario"]} />
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <>
          <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(detalleFiltrado, "prestamos.csv")}>⬇ CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Capital</th><th>Pagado</th><th>Restante</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {detalleFiltrado.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.cliente_nombre}</td>
                    <td>{fmt(r.capital)}</td>
                    <td style={{ color: "var(--success)" }}>{fmt(r.total_pagado)}</td>
                    <td style={{ color: "var(--danger)", fontWeight: 600 }}>{fmt(r.monto_restante)}</td>
                    <td><span className="badge" style={{ color: ESTADO_COLOR[r.estado] ?? "inherit" }}>{r.estado}</span></td>
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
function ReporteDeuda({ clientes, usuarios }: { clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; }) {
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState<any[]>([]); 
  const [cargado, setCargado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<any[]>(`/reportes/clientes-deuda`);
      setData(Array.isArray(res) ? res : []);
      setCargado(true);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const dataFiltrada = useMemo(() => {
    if (!data) return [];
    if (!clienteId) return data;
    return data.filter(r => r.id === clienteId);
  }, [data, clienteId]);

  return (
    <div>
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectFiltro id="filtro-cliente-deuda" label="Cliente" value={clienteId} onChange={setClienteId} options={clientes.map(c => ({ id: c.id, label: c.nombre }))} placeholder="— Todos los clientes —" />
        </div>
      </div>
      <div style={{ marginBottom: "1.25rem", display: "flex", gap: "8px" }}>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading ? "Cargando..." : "Generar reporte"}</button>
        {cargado && dataFiltrada.length > 0 && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(dataFiltrada, "clientes-deuda.csv")}>⬇ CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={imprimir}>🖨 Imprimir</button>
          </>
        )}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {cargado && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cliente</th><th>Capital total</th><th>Total pagado</th><th>Deuda total</th></tr>
            </thead>
            <tbody>
              {dataFiltrada.map((r: any, i: number) => (
                <tr key={r.id || i}>
                  <td className="font-medium">{r.nombre}</td>
                  <td>{fmt(r.capital_total)}</td>
                  <td style={{ color: "var(--success)" }}>{fmt(r.total_pagado)}</td>
                  <td style={{ fontWeight: 700, color: "var(--danger)" }}>{fmt(r.deuda_total)}</td>
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
function ReporteVencidas({ clientes, usuarios }: { clientes: ClienteOpc[]; usuarios: UsuarioOpc[]; }) {
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true); setError(null);
    try {
      setData(await api.get<any>(`/reportes/cuotas-vencidas`));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const detalleFiltrado = useMemo(() => {
    if (!data || !data.detalle) return [];
    if (!clienteId) return data.detalle;
    return data.detalle.filter((r: any) => r.cliente_id === clienteId);
  }, [data, clienteId]);

  return (
    <div>
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectFiltro id="filtro-cliente-venc" label="Cliente" value={clienteId} onChange={setClienteId} options={clientes.map(c => ({ id: c.id, label: c.nombre }))} placeholder="— Todos los clientes —" />
        </div>
      </div>
      <div style={{ marginBottom: "1.25rem", display: "flex", gap: "8px" }}>
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>{loading ? "Cargando..." : "Generar reporte"}</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cliente</th><th>Cuotas Vencidas</th><th>Monto Vencido</th></tr>
            </thead>
            <tbody>
              {detalleFiltrado.map((r: any, idx: number) => (
                <tr key={r.cliente_id || idx}>
                  <td className="font-medium">{r.cliente_nombre}</td>
                  <td><span className="badge badge-danger">{r.cuotas_vencidas}</span></td>
                  <td style={{ color: "var(--danger)", fontWeight: 600 }}>{fmt(r.monto_vencido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Vista Principal Contenedora ─────────────────
export default function PanelReportes() {
  const [tabActiva, setTabActiva] = useState<TabReporte>("cobros");
  const { clientes, usuarios, prestamos } = useCatalogos();

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "1.5rem", fontWeight: 600 }}>Centro de Reportes Analíticos</h2>
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {TAB_CONFIG.map(tab => (
          <button key={tab.key} onClick={() => setTabActiva(tab.key)} className={`btn ${tabActiva === tab.key ? "btn-primary" : "btn-ghost"}`} style={{ borderRadius: "var(--radius-md) var(--radius-md) 0 0", borderBottom: "none", padding: "0.5rem 1rem" }}>
            <span style={{ marginRight: "6px" }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>
      <div style={{ background: "var(--bg-1)", minHeight: "300px" }}>
        {tabActiva === "cobros" && <ReporteCobros clientes={clientes} usuarios={usuarios} prestamos={prestamos} />}
        {tabActiva === "prestamos" && <ReportePrestamos clientes={clientes} usuarios={usuarios} prestamos={prestamos} />}
        {tabActiva === "deuda" && <ReporteDeuda clientes={clientes} usuarios={usuarios} />}
        {tabActiva === "vencidas" && <ReporteVencidas clientes={clientes} usuarios={usuarios} />}
      </div>
    </div>
  );
}