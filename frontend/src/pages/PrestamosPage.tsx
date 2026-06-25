import React, { useState, useMemo } from "react";
import { usePrestamos } from "../hooks/usePrestamos";
import { useClientes } from "../hooks/useClientes";
import type { CrearPrestamoDTO, EstadoPrestamo, TipoPlazo, Prestamo } from "../types";
import { IconPlus, IconX, IconCash } from "../components/Icons";

// Estados válidos en el backend (del enum de PostgreSQL)
const ESTADOS: EstadoPrestamo[] = ["PENDIENTE", "APROBADO", "ACTIVO", "PAGADO", "MOROSO", "CANCELADO"];

// El botón Cobrar solo se habilita si el préstamo está en estos estados
// (el backend rechaza PENDIENTE, PAGADO y CANCELADO)
const ESTADOS_COBRABLES: EstadoPrestamo[] = ["ACTIVO", "MOROSO"];

const TIPO_PLAZO_OPCIONES: { value: TipoPlazo; label: string }[] = [
  { value: "MENSUAL",   label: "Mensual"   },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "SEMANAL",   label: "Semanal"   },
  { value: "DIARIO",    label: "Diario"    },
];

const TIPO_PLAZO_LABEL: Record<TipoPlazo, string> = {
  MENSUAL:   "Mensual",
  QUINCENAL: "Quincenal",
  SEMANAL:   "Semanal",
  DIARIO:    "Diario",
};

const CUOTAS_POR_MES: Record<TipoPlazo, number> = {
  MENSUAL:   1,
  QUINCENAL: 2,
  SEMANAL:   4,
  DIARIO:    30,
};

function fmt(n: number) {
  return Number(n).toLocaleString("es-DO", {
    style: "currency", currency: "DOP", maximumFractionDigits: 0,
  });
}
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `RD$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `RD$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}
function fmtFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function getFechaHoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function genRecibo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `REC-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${String(now.getTime()).slice(-5)}`;
}

const HOY_STR = getFechaHoyLocal();

const EMPTY: CrearPrestamoDTO = {
  clienteId: "", capital: 0, tasaAnual: 0, plazoMeses: 12, tipoPlazo: "MENSUAL",
};

// ─── Baucher de cobro ─────────────────────────────────────────────────────────
interface BaucherPrestamoProps {
  prestamo:  Prestamo;
  monto:     number;
  recibo:    string;
  fechaPago: string;
  onCerrar:  () => void;
}

function BaucherPrestamo({ prestamo, monto, recibo, fechaPago, onCerrar }: BaucherPrestamoProps) {
  const cuota      = Number(prestamo.cuota_mensual);
  const diferencia = monto - cuota;
  const esAdelanto = diferencia > 0;
  const esParcial  = diferencia < 0;
  const restante   = Number(prestamo.monto_restante ?? prestamo.capital);

  const handleImprimir = () => {
    const contenido = document.getElementById("baucher-prestamo-contenido");
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
          body { font-family:'Courier New',monospace; font-size:12px; color:#111;
                 width:380px; margin:0 auto; padding:20px 16px; }
          .divider       { border:none; border-top:1px dashed #aaa; margin:10px 0; }
          .divider-solid { border:none; border-top:2px solid #111; margin:10px 0; }
          .sec-title     { font-size:10px; font-weight:700; text-transform:uppercase;
                           letter-spacing:.08em; color:#555; margin-bottom:6px; }
          .fila          { display:flex; justify-content:space-between; margin-bottom:3px; font-size:11px; }
          .fila .lbl     { color:#666; }
          .fila .val     { font-weight:600; }
          @media print   { body { width:100%; padding:8px; } }
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
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={{ maxWidth: "420px", padding: 0, overflow: "hidden" }}>

        {/* Header */}
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="modal-title">Baucher de cobro</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-primary btn-sm" onClick={handleImprimir}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              🖨 Imprimir
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onCerrar} aria-label="Cerrar">✕</button>
          </div>
        </div>

        {/* Contenido imprimible */}
        <div id="baucher-prestamo-contenido" style={{
          padding: "20px 24px", fontFamily: "'Courier New', monospace",
          fontSize: "12px", color: "#111", background: "#fff",
        }}>
          {/* Encabezado empresa */}
          <div style={{ textAlign: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "1px" }}>
              PRESTAMOS & COBROS
            </div>
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              Comprobante oficial de pago
            </div>
          </div>

          <div style={{ textAlign: "center", fontSize: "10px", color: "#888", marginBottom: "10px" }}>
            {recibo}
          </div>

          <hr style={{ border: "none", borderTop: "2px solid #111", margin: "0 0 10px" }} />

          {/* Monto destacado */}
          <div style={{ textAlign: "center", margin: "14px 0 12px" }}>
            <div style={{ fontSize: "10px", color: "#666", marginBottom: "2px" }}>MONTO COBRADO</div>
            <div style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1 }}>
              {fmt(monto)}
            </div>
            <div style={{ marginTop: "8px" }}>
              {esParcial ? (
                <span style={{
                  display:"inline-block", padding:"2px 10px", borderRadius:"99px",
                  fontSize:"10px", fontWeight:700, letterSpacing:".05em",
                  background:"#fff7e0", color:"#7a5200", border:"1px solid #ffd666",
                }}>
                  PAGO PARCIAL — FALTA {fmt(Math.abs(diferencia))}
                </span>
              ) : esAdelanto ? (
                <span style={{
                  display:"inline-block", padding:"2px 10px", borderRadius:"99px",
                  fontSize:"10px", fontWeight:700, letterSpacing:".05em",
                  background:"#e6f4ff", color:"#003a8c", border:"1px solid #91caff",
                }}>
                  INCLUYE ADELANTO DE {fmt(diferencia)}
                </span>
              ) : (
                <span style={{
                  display:"inline-block", padding:"2px 10px", borderRadius:"99px",
                  fontSize:"10px", fontWeight:700, letterSpacing:".05em",
                  background:"#d4f5e2", color:"#0a6637", border:"1px solid #7de0a8",
                }}>
                  ✓ CUOTA COMPLETA
                </span>
              )}
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Datos del cliente */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize:"10px", fontWeight:700, textTransform:"uppercase",
              letterSpacing:".08em", color:"#555", marginBottom:"6px" }}>
              DATOS DEL CLIENTE
            </div>
            {[
              ["Cliente",  prestamo.cliente_nombre ?? "—"],
              ["Código",   prestamo.codigo         ?? "—"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px", fontSize:"11px" }}>
                <span style={{ color:"#666" }}>{lbl}</span>
                <span style={{ fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Detalle del préstamo */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize:"10px", fontWeight:700, textTransform:"uppercase",
              letterSpacing:".08em", color:"#555", marginBottom:"6px" }}>
              DETALLE DEL PRÉSTAMO
            </div>
            {[
              ["Capital",          fmt(Number(prestamo.capital))],
              ["Tasa anual",       `${prestamo.tasa_anual}%`],
              ["Plazo",            `${prestamo.plazo_meses} meses`],
              ["Frecuencia",       TIPO_PLAZO_LABEL[prestamo.tipo_plazo] ?? prestamo.tipo_plazo],
              ["Cuota esperada",   fmt(cuota)],
              ["Monto restante",   restante > 0 ? fmt(restante) : "Saldado ✓"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px", fontSize:"11px" }}>
                <span style={{ color:"#666" }}>{lbl}</span>
                <span style={{ fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Detalle del pago */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize:"10px", fontWeight:700, textTransform:"uppercase",
              letterSpacing:".08em", color:"#555", marginBottom:"6px" }}>
              DETALLE DEL PAGO
            </div>
            {[
              ["Fecha de pago",  fmtFecha(fechaPago)],
              ["Monto cobrado",  fmt(monto)],
              ...(esParcial  ? [["Saldo pendiente",  fmt(Math.abs(diferencia))]] : []),
              ...(esAdelanto ? [["Monto adelantado", fmt(diferencia)]]           : []),
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px", fontSize:"11px" }}>
                <span style={{ color:"#666" }}>{lbl}</span>
                <span style={{ fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "2px solid #111", margin: "10px 0" }} />

          {/* Pie */}
          <div style={{ textAlign:"center", fontSize:"9px", color:"#888", lineHeight:"1.7" }}>
            <div>Conserve este comprobante como respaldo de su pago.</div>
            <div>Generado el {new Date().toLocaleString("es-DO")}</div>
          </div>
        </div>

        {/* Footer modal */}
        <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", gap: "8px" }}>
          <button className="btn btn-ghost" onClick={onCerrar}>Cerrar</button>
          <button className="btn btn-primary" onClick={handleImprimir}
            style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            🖨 Imprimir baucher
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de cobro ───────────────────────────────────────────────────────────
interface ModalCobroProps {
  prestamo:  Prestamo;
  onClose:   () => void;
  onConfirm: (prestamoId: string, monto: number) => Promise<void>;
}

function ModalCobro({ prestamo, onClose, onConfirm }: ModalCobroProps) {
  const [monto,   setMonto]   = useState<number>(Number(prestamo.cuota_mensual));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [baucher, setBaucher] = useState<{ monto: number; recibo: string; fecha: string } | null>(null);

  const cuota = Number(prestamo.cuota_mensual);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto <= 0) { setError("El monto debe ser mayor a 0"); return; }
    setError(null);
    setSaving(true);
    try {
      // onConfirm recibe (prestamoId, monto) — el hook llama a cobrosService.registrar()
      await onConfirm(prestamo.id, monto);
      setBaucher({ monto, recibo: genRecibo(), fecha: HOY_STR });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar el cobro");
    } finally {
      setSaving(false);
    }
  };

  // Cobro exitoso → mostrar baucher directamente
  if (baucher) {
    return (
      <BaucherPrestamo
        prestamo={prestamo}
        monto={baucher.monto}
        recibo={baucher.recibo}
        fechaPago={baucher.fecha}
        onCerrar={onClose}
      />
    );
  }

  const pct   = Math.min((monto / cuota) * 100, 100);
  const color = monto >= cuota ? "var(--success)" : monto > 0 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Registrar cobro</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><IconX /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Resumen del préstamo */}
            <div style={{
              background: "var(--bg-2)", borderRadius: "var(--radius-md)",
              padding: "0.875rem 1rem", marginBottom: "1.25rem",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.82rem",
            }}>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>Cliente</p>
                <p style={{ fontWeight: 500 }}>{prestamo.cliente_nombre}</p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>
                  Cuota / {TIPO_PLAZO_LABEL[prestamo.tipo_plazo] ?? "período"}
                </p>
                <p style={{ fontWeight: 500, color: "var(--brand)" }}>{fmt(cuota)}</p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>Capital</p>
                <p style={{ fontWeight: 500 }}>{fmt(Number(prestamo.capital))}</p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>Monto restante</p>
                <p style={{ fontWeight: 500, color: "var(--danger)" }}>
                  {fmt(Number(prestamo.monto_restante ?? prestamo.capital))}
                </p>
              </div>
            </div>

            {error && <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="monto-prestamo">Monto a cobrar (DOP)</label>
              <input
                id="monto-prestamo" className="form-input" type="number"
                min={1} step="0.01" value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
                placeholder="0.00" required autoFocus
              />
              <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonto(cuota)}>
                  Cuota completa — {fmt(cuota)}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonto(Math.round(cuota / 2))}>
                  50% — {fmt(Math.round(cuota / 2))}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonto(Math.round(cuota * 2))}>
                  2 cuotas — {fmt(Math.round(cuota * 2))}
                </button>
              </div>
            </div>

            {/* Barra de progreso */}
            {monto > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "4px" }}>
                  <span>Pago vs cuota</span>
                  <span style={{ color, fontWeight: 500 }}>
                    {monto >= cuota ? "Cuota completa ✓" : `Falta ${fmt(cuota - monto)}`}
                  </span>
                </div>
                <div style={{ height: "6px", background: "var(--border)", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color,
                    borderRadius: "99px", transition: "width 0.2s ease" }} />
                </div>
                {monto > cuota && (
                  <p style={{ fontSize: "0.78rem", color: "var(--success)", marginTop: "4px" }}>
                    Pago adelantado: {fmt(monto - cuota)} extra
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || monto <= 0}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {saving ? "Registrando..." : `✓ Cobrar ${monto > 0 ? fmt(monto) : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function PrestamosPage() {
  const { prestamos, loading, error, cargar, crear, cambiarEstado, registrarCobro } = usePrestamos();
  const { clientes } = useClientes();

  const [showModal,        setShowModal]        = useState(false);
  const [form,             setForm]             = useState<CrearPrestamoDTO>(EMPTY);
  const [formError,        setFormError]        = useState<string | null>(null);
  const [saving,           setSaving]           = useState(false);
  const [prestamoACobrar,  setPrestamoACobrar]  = useState<Prestamo | null>(null);
  const [busqueda,         setBusqueda]         = useState("");
  const [prestamoAEditar,  setPrestamoAEditar]  = useState<Prestamo | null>(null);

  const prestamosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return prestamos;
    return prestamos.filter(
      (p) =>
        p.cliente_nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)         ||
        p.estado?.toLowerCase().includes(q)         ||
        p.tipo_plazo?.toLowerCase().includes(q)
    );
  }, [prestamos, busqueda]);

  const openModal  = () => { setForm(EMPTY); setFormError(null); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const closeCobro = () => { setPrestamoACobrar(null); cargar(); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "clienteId" || name === "tipoPlazo" ? value : Number(value),
    }));
  };

  const cuotaEstimada = useMemo(() => {
    if (form.capital <= 0 || form.plazoMeses <= 0) return 0;
    const factorCuotas = CUOTAS_POR_MES[form.tipoPlazo];
    const totalCuotas  = form.plazoMeses * factorCuotas;
    if (form.tasaAnual === 0) return form.capital / totalCuotas;
    const r = (form.tasaAnual / 100) / 12 / factorCuotas;
    const n = totalCuotas;
    return (form.capital * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  }, [form.capital, form.plazoMeses, form.tasaAnual, form.tipoPlazo]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await crear(form);
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error al crear préstamo");
    } finally {
      setSaving(false);
    }
  };

  const totalCapital  = prestamos.reduce((a, p) => a + Number(p.capital), 0);
  const totalRestante = prestamos.reduce((a, p) => a + Number(p.monto_restante ?? p.capital), 0);
  const activos       = prestamos.filter((p) => p.estado === "ACTIVO").length;

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Préstamos</span>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={openModal}>
            <IconPlus size={15} /> Nuevo préstamo
          </button>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Total préstamos</p>
            <p className="stat-value">{prestamos.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Activos</p>
            <p className="stat-value" style={{ color: "var(--brand)" }}>{activos}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Capital total</p>
            <p className="stat-value" style={{ fontSize: "1.2rem" }} title={fmt(totalCapital)}>
              {fmtCompact(totalCapital)}
            </p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Por cobrar</p>
            <p className="stat-value" style={{ fontSize: "1.2rem", color: "var(--danger)" }} title={fmt(totalRestante)}>
              {fmtCompact(totalRestante)}
            </p>
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Listado de préstamos</span>
            <span className="text-sm text-muted">{prestamosFiltrados.length} registros</span>
          </div>

          <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
            <input
              className="form-input" type="search"
              placeholder="Buscar por cliente, código, estado o tipo de plazo..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: "420px" }}
            />
          </div>

          {loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
              Cargando préstamos...
            </div>
          )}
          {error && (
            <div style={{ padding: "1rem 1.5rem" }}>
              <div className="alert alert-danger">{error}</div>
            </div>
          )}
          {!loading && prestamos.length === 0 && (
            <div className="empty-state">
              <p>No hay préstamos registrados aún.</p>
              <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={openModal}>
                <IconPlus size={15} /> Crear primer préstamo
              </button>
            </div>
          )}
          {!loading && prestamos.length > 0 && prestamosFiltrados.length === 0 && (
            <div className="empty-state">
              <p>No se encontraron préstamos para "<strong>{busqueda}</strong>".</p>
              <button className="btn btn-ghost" style={{ marginTop: "0.75rem" }} onClick={() => setBusqueda("")}>
                Limpiar búsqueda
              </button>
            </div>
          )}

          {!loading && prestamosFiltrados.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Tasa</th>
                    <th>Capital</th>
                    <th>Monto restante</th>
                    <th>Plazo</th>
                    <th>Frecuencia</th>
                    <th>Estado</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {prestamosFiltrados.map((p: Prestamo) => {
                    // El backend solo acepta cobros en ACTIVO o MOROSO
                    const cobrable    = ESTADOS_COBRABLES.includes(p.estado);
                    const restante    = Number(p.monto_restante ?? p.capital);
                    const totalAPagar = Number(p.cuota_mensual) * Number(p.plazo_meses);
                    const pctPagado   = totalAPagar > 0
                      ? Math.min(((totalAPagar - restante) / totalAPagar) * 100, 100)
                      : 0;

                    return (
                      <tr key={p.id}>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-3)" }}>
                            {p.codigo ?? "—"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="avatar" style={{ width: "30px", height: "30px", fontSize: "0.7rem" }}>
                              {(p.cliente_nombre ?? "?").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium">{p.cliente_nombre}</span>
                          </div>
                        </td>
                        <td className="text-muted">{p.tasa_anual}%</td>
                        <td className="font-medium">{fmt(Number(p.capital))}</td>
                        <td style={{ minWidth: "160px" }}>
                          <div style={{ fontWeight: 600, color: restante <= 0 ? "var(--success)" : "var(--danger)", marginBottom: "4px" }}>
                            {restante <= 0 ? "Saldado ✓" : fmt(restante)}
                          </div>
                          <div style={{ height: "4px", background: "var(--border)", borderRadius: "99px", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${pctPagado}%`,
                              background: pctPagado >= 100 ? "var(--success)" : "var(--brand)",
                              borderRadius: "99px", transition: "width 0.3s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: "2px" }}>
                            {pctPagado.toFixed(0)}% pagado
                          </div>
                        </td>
                        <td className="text-muted">{p.plazo_meses}m</td>
                        <td>
                          <span style={{
                            fontSize: "0.75rem", fontWeight: 500,
                            color: "var(--brand)", background: "var(--brand-light)",
                            padding: "2px 8px", borderRadius: "99px",
                          }}>
                            {TIPO_PLAZO_LABEL[p.tipo_plazo] ?? p.tipo_plazo}
                          </span>
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={p.estado}
                            onChange={(e) => cambiarEstado(p.id, e.target.value as EstadoPrestamo).then(() => cargar())}
                            style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                            aria-label={`Estado de ${p.cliente_nombre}`}
                          >
                            {ESTADOS.map((est) => (
                              <option key={est} value={est}>
                                {est.charAt(0) + est.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setPrestamoACobrar(p)}
                            disabled={!cobrable}
                            title={
                              !cobrable
                                ? `No se puede cobrar en estado ${p.estado}. Cambia el estado a ACTIVO o MOROSO.`
                                : "Registrar cobro"
                            }
                            style={{ display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap" }}
                          >
                            <IconCash size={14} />
                            Cobrar
                          </button>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setPrestamoAEditar(p)}
                              title="Editar préstamo"
                            >
                              ✏️ Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal nuevo préstamo */}
      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nuevo préstamo</span>
              <button className="btn btn-ghost btn-icon" onClick={closeModal} aria-label="Cerrar modal"><IconX /></button>
            </div>
            <form onSubmit={handleCrear}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="clienteId">Cliente</label>
                  <select id="clienteId" className="form-select" name="clienteId"
                    value={form.clienteId} onChange={handleChange} required>
                    <option value="">— Seleccionar cliente —</option>
                    {clientes.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={(c.score ?? 0) < 600}
                      >
                        {c.nombre} — score {c.score ?? "N/A"}
                        {(c.score ?? 0) < 600 ? " (no apto)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Capital (DOP)</label>
                    <input className="form-input" name="capital" type="number" placeholder="50000"
                      min={1} value={form.capital || ""} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tasa anual (%)</label>
                    <input className="form-input" name="tasaAnual" type="number" placeholder="12.5"
                      step="0.1" min={0} value={form.tasaAnual || ""} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Plazo (meses)</label>
                    <input className="form-input" name="plazoMeses" type="number" placeholder="24"
                      min={1} value={form.plazoMeses || ""} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="tipoPlazo">Frecuencia de pago</label>
                    <select id="tipoPlazo" className="form-select" name="tipoPlazo"
                      value={form.tipoPlazo} onChange={handleChange} required>
                      {TIPO_PLAZO_OPCIONES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {cuotaEstimada > 0 && (
                  <div style={{ background: "var(--brand-light)", border: "1px solid #c3d7fc",
                    borderRadius: "var(--radius-md)", padding: "0.875rem 1rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--brand)", fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: ".04em", marginBottom: "0.25rem" }}>
                      Cuota estimada ({TIPO_PLAZO_LABEL[form.tipoPlazo]})
                    </p>
                    <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--brand)" }}>
                      {fmt(cuotaEstimada)}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--brand)", opacity: 0.7, marginTop: "2px" }}>
                      {form.plazoMeses * CUOTAS_POR_MES[form.tipoPlazo]} cuotas en total
                    </p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Creando..." : "Crear préstamo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de cobro → baucher */}
      {prestamoACobrar && (
        <ModalCobro
          prestamo={prestamoACobrar}
          onClose={closeCobro}
          onConfirm={(id, monto) => registrarCobro(id, monto).then(() => {})}
        />
      )}
    </>
  );
}