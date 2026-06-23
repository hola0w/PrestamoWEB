import { useState, useEffect, useMemo } from "react";
import { cobrosService } from "../services/cobrosService";
import type { Cobro } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return Number(n).toLocaleString("es-DO", {
    style: "currency", currency: "DOP", maximumFractionDigits: 0,
  });
}

function fmtFecha(f: string | null) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const BADGE: Record<string, string> = {
  PAGADO:    "badge badge-success",
  PARCIAL:   "badge badge-warning",
  ATRASADO:  "badge badge-danger",
  PENDIENTE: "badge badge-gray",
};

// ─── Baucher de reimpresión ───────────────────────────────────────────────────
interface BaucherReimpresionProps {
  cobro:    Cobro;
  onCerrar: () => void;
}

function BaucherReimpresion({ cobro, onCerrar }: BaucherReimpresionProps) {
  const monto  = Number(cobro.monto_pagado);
  const recibo = cobro.id.slice(0, 8).toUpperCase();

  const handleImprimir = () => {
    const contenido = document.getElementById("baucher-reimp-contenido");
    if (!contenido) return;
    const ventana = window.open("", "_blank", "width=420,height=680");
    if (!ventana) return;
    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>Baucher ${recibo}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body {
            font-family: 'Courier New', monospace; font-size: 12px; color: #111;
            width: 380px; margin: 0 auto; padding: 20px 16px;
          }
          .reimp-banner {
            text-align:center; background:#fff7e0; border:1px solid #ffd666;
            border-radius:6px; padding:5px 10px; margin:10px 0;
            font-size:10px; font-weight:700; color:#7a5200;
            letter-spacing:.05em; text-transform:uppercase;
          }
          @media print { body { width:100%; padding:8px; } }
        </style>
      </head>
      <body>
        ${contenido.innerHTML}
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    ventana.document.close();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div className="modal" style={{ maxWidth: "420px", padding: 0, overflow: "hidden" }}>

        {/* Header */}
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="modal-title">Reimprimir baucher</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImprimir}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              🖨 Imprimir
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onCerrar} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* Cuerpo del baucher */}
        <div
          id="baucher-reimp-contenido"
          style={{
            padding: "20px 24px",
            fontFamily: "'Courier New', monospace",
            fontSize: "12px",
            color: "#111",
            background: "#fff",
          }}
        >
          {/* Cabecera empresa */}
          <div style={{ textAlign: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "1px" }}>
              PRESTAMOS &amp; COBROS
            </div>
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              Comprobante oficial de pago
            </div>
          </div>

          {/* Número de referencia */}
          <div style={{ textAlign: "center", fontSize: "10px", color: "#888", marginBottom: "8px" }}>
            REF-{recibo}
          </div>

          {/* Banner de reimpresión */}
          <div style={{
            textAlign: "center",
            background: "#fff7e0",
            border: "1px solid #ffd666",
            borderRadius: "6px",
            padding: "5px 10px",
            marginBottom: "10px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#7a5200",
            letterSpacing: ".05em",
            textTransform: "uppercase" as const,
          }}>
            ⚠ Comprobante reimpreso
          </div>

          <hr style={{ border: "none", borderTop: "2px solid #111", margin: "0 0 10px" }} />

          {/* Monto principal */}
          <div style={{ textAlign: "center", margin: "14px 0 12px" }}>
            <div style={{ fontSize: "10px", color: "#666", marginBottom: "2px" }}>
              MONTO COBRADO
            </div>
            <div style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1 }}>
              {fmt(monto)}
            </div>
            <div style={{ marginTop: "8px" }}>
              <span style={{
                display: "inline-block", padding: "2px 10px", borderRadius: "99px",
                fontSize: "10px", fontWeight: 700,
                background: "#d4f5e2", color: "#0a6637", border: "1px solid #7de0a8",
              }}>
                {cobro.estado_cobro}
              </span>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Datos del cliente */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".08em", color: "#555", marginBottom: "6px",
            }}>
              DATOS DEL CLIENTE
            </div>
            {([
              ["Cliente",  cobro.cliente_nombre ?? "—"],
            //  ["Teléfono", cobro.telefono1      ?? "—"],
            ] as [string, string][]).map(([lbl, val]) => (
              <div
                key={lbl}
                style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "11px" }}
              >
                <span style={{ color: "#666" }}>{lbl}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Detalle del cobro */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".08em", color: "#555", marginBottom: "6px",
            }}>
              DETALLE DEL COBRO
            </div>
            {([
              ["Cuota préstamo", cobro.cuota_mensual != null ? fmt(Number(cobro.cuota_mensual)) : "—"],
              ["Monto cobrado",  fmt(monto)],
              ["Fecha cobro",    fmtFecha(cobro.created_at)],
            ] as [string, string][]).map(([lbl, val]) => (
              <div
                key={lbl}
                style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "11px" }}
              >
                <span style={{ color: "#666" }}>{lbl}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "2px solid #111", margin: "10px 0" }} />

          {/* Pie */}
          <div style={{ textAlign: "center", fontSize: "9px", color: "#888", lineHeight: "1.7" }}>
            <div>Este es un comprobante de reimpresión.</div>
            <div>Conserve el original como respaldo oficial.</div>
            <div>Reimpreso el {new Date().toLocaleString("es-DO")}</div>
          </div>
        </div>

        {/* Footer del modal */}
        <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", gap: "8px" }}>
          <button className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
          <button
            className="btn btn-primary"
            onClick={handleImprimir}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            🖨 Reimprimir baucher
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function RegistroPage() {
  const [cobros,       setCobros]       = useState<Cobro[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [busqueda,     setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "PAGADO" | "PARCIAL" | "ATRASADO">("TODOS");
  const [fechaDesde,   setFechaDesde]   = useState("");
  const [fechaHasta,   setFechaHasta]   = useState("");
  const [cobroAReimpr, setCobroAReimpr] = useState<Cobro | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cobrosService.listar();
      setCobros(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar cobros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cobros.filter((c) => {
      if (q && !c.cliente_nombre?.toLowerCase().includes(q)) return false;
      if (filtroEstado !== "TODOS" && c.estado_cobro !== filtroEstado) return false;
      const fecha = c.created_at?.split("T")[0] ?? "";
      if (fechaDesde && fecha < fechaDesde) return false;
      if (fechaHasta && fecha > fechaHasta) return false;
      return true;
    });
  }, [cobros, busqueda, filtroEstado, fechaDesde, fechaHasta]);

  const totalCobrado = filtrados
    .filter((c) => c.estado_cobro === "PAGADO")
    .reduce((s, c) => s + Number(c.monto_pagado), 0);

  const totalParcial = filtrados
    .filter((c) => c.estado_cobro === "PARCIAL")
    .reduce((s, c) => s + Number(c.monto_pagado), 0);

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">💰 Historial de Cobros</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
            {loading ? "Actualizando..." : "↻ Actualizar"}
          </button>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--brand)" }}>
            <p className="stat-label">Total registros</p>
            <p className="stat-value">{filtrados.length}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--success)" }}>
            <p className="stat-label">Total cobrado</p>
            <p className="stat-value" style={{ color: "var(--success)", fontSize: "1.3rem" }}>
              {fmt(totalCobrado)}
            </p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--warning)" }}>
            <p className="stat-label">Pagos parciales</p>
            <p className="stat-value" style={{ color: "var(--warning)", fontSize: "1.3rem" }}>
              {fmt(totalParcial)}
            </p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--text-3)" }}>
            <p className="stat-label">Cobros pagados</p>
            <p className="stat-value">
              {cobros.filter((c) => c.estado_cobro === "PAGADO").length}
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Registro de cobros</span>
            <span className="text-sm text-muted">{filtrados.length} registros</span>
          </div>

          {/* Filtros */}
          <div style={{
            padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)",
            display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap",
          }}>
            <input
              className="form-input" type="search"
              placeholder="Buscar por cliente..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: "220px", flex: "1 1 180px" }}
            />
            <input
              className="form-input" type="date"
              value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              style={{ maxWidth: "160px" }} title="Desde"
            />
            <input
              className="form-input" type="date"
              value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              style={{ maxWidth: "160px" }} title="Hasta"
            />
            {(["TODOS", "PAGADO", "PARCIAL", "ATRASADO"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                style={{
                  padding: "5px 14px", borderRadius: "99px", fontSize: "0.8rem",
                  border: "1px solid",
                  borderColor: filtroEstado === e ? "var(--brand)" : "var(--border)",
                  background:  filtroEstado === e ? "var(--brand)" : "transparent",
                  color:       filtroEstado === e ? "#fff" : "var(--text-2)",
                  cursor: "pointer", fontWeight: filtroEstado === e ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {e === "TODOS" ? "Todos" : e}
              </button>
            ))}
            {(busqueda || filtroEstado !== "TODOS" || fechaDesde || fechaHasta) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setBusqueda(""); setFiltroEstado("TODOS"); setFechaDesde(""); setFechaHasta(""); }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          {error && (
            <div style={{ padding: "1rem 1.5rem" }}>
              <div className="alert alert-danger">{error}</div>
            </div>
          )}

          {loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
              Cargando cobros...
            </div>
          )}

          {!loading && filtrados.length === 0 && (
            <div className="empty-state">
              <p>No hay cobros que coincidan con el filtro.</p>
            </div>
          )}

          {!loading && filtrados.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Monto cobrado</th>
                    <th>Cuota préstamo</th>
                    <th>Estado</th>
                    <th>Fecha cobro</th>
                    <th>Actualizado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            className="avatar"
                            style={{ width: "30px", height: "30px", fontSize: "0.7rem", flexShrink: 0 }}
                          >
                            {(c.cliente_nombre ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">{c.cliente_nombre ?? "—"}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--success)" }}>
                        {fmt(Number(c.monto_pagado))}
                      </td>
                      <td style={{ color: "var(--text-2)" }}>
                        {c.cuota_mensual != null ? fmt(Number(c.cuota_mensual)) : "—"}
                      </td>
                      <td>
                        <span className={BADGE[c.estado_cobro] ?? "badge badge-gray"}>
                          {c.estado_cobro}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {fmtFecha(c.created_at)}
                      </td>
                      <td className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {fmtFecha(c.updated_at)}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setCobroAReimpr(c)}
                          title="Reimprimir baucher"
                          style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}
                        >
                          🖨 Reimprimir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de reimpresión */}
      {cobroAReimpr && (
        <BaucherReimpresion
          cobro={cobroAReimpr}
          onCerrar={() => setCobroAReimpr(null)}
        />
      )}
    </>
  );
}