import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";

interface Cuota {
  id: string;
  prestamo_id: string;
  numero_cuota: number;
  fecha_vence: string;
  monto_cuota: number;
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO";
  fecha_pago: string | null;
  cliente_nombre: string;
  telefono1: string;
  telefono2: string | null;
  capital: number;
  cuota_mensual: number;
  tipo_plazo: string;
  estado_prestamo: string;
  dias_atraso: number;
}

interface Resumen {
  total_pendiente: number;
  vencen_hoy: number;
  vencidas: number;
  total_pagadas: number;
  monto_pendiente: number;
  monto_hoy: number;
  monto_vencido: number;
  monto_cobrado: number;
}

type TabActiva = "HOY" | "PENDIENTES" | "VENCIDAS" | "PAGADAS";

const TIPO_PLAZO_LABEL: Record<string, string> = {
  DIARIO: "Diario",
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
};

function fmt(n: number) {
  return Number(n).toLocaleString("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  });
}
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `RD$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RD$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}
function fmtFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFechaHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const HOY_STR = getFechaHoyLocal();

// ─── Generador de número de recibo ──────────────────────────────────────────
function genRecibo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `REC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(now.getTime()).slice(-5)}`;
}

// ─── Baucher de cobro (pantalla de impresión) ────────────────────────────────
interface BaucherProps {
  cuota: Cuota;
  monto: number;
  recibo: string;
  fechaPago: string;
  onCerrar: () => void;
}

function BaucherCobro({ cuota, monto, recibo, fechaPago, onCerrar }: BaucherProps) {
  const montoEsperado  = Number(cuota.monto_cuota);
  const diferencia     = monto - montoEsperado;
  const esAdelanto     = diferencia > 0;
  const esParcial      = diferencia < 0;

  const handleImprimir = () => {
    const contenido = document.getElementById("baucher-contenido");
    if (!contenido) return;
    const ventana = window.open("", "_blank", "width=420,height=620");
    if (!ventana) return;
    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>Baucher ${recibo}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; color: #111;
                 width: 380px; margin: 0 auto; padding: 20px 16px; }
          .logo-area  { text-align:center; margin-bottom:12px; }
          .empresa    { font-size:16px; font-weight:700; letter-spacing:1px; }
          .subtitulo  { font-size:10px; color:#555; margin-top:2px; }
          .divider    { border:none; border-top:1px dashed #999; margin:10px 0; }
          .divider-solid { border:none; border-top:2px solid #111; margin:10px 0; }
          .titulo-sec { font-size:11px; font-weight:700; text-transform:uppercase;
                        letter-spacing:.08em; color:#444; margin-bottom:6px; }
          .fila       { display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px; }
          .fila .lbl  { color:#555; }
          .fila .val  { font-weight:600; text-align:right; max-width:60%; }
          .monto-total{ text-align:center; margin:14px 0 10px; }
          .monto-total .lbl { font-size:11px; color:#555; }
          .monto-total .num { font-size:28px; font-weight:700; letter-spacing:-.5px; }
          .badge      { display:inline-block; padding:2px 10px; border-radius:99px;
                        font-size:10px; font-weight:700; letter-spacing:.05em; }
          .badge-ok   { background:#d4f5e2; color:#0a6637; border:1px solid #7de0a8; }
          .badge-par  { background:#fff7e0; color:#7a5200; border:1px solid #ffd666; }
          .badge-adv  { background:#e6f4ff; color:#003a8c; border:1px solid #91caff; }
          .nota       { font-size:10px; color:#666; margin-top:3px; }
          .footer     { text-align:center; margin-top:14px; font-size:9px; color:#888; line-height:1.6; }
          .recibo-num { font-size:10px; color:#888; text-align:center; margin-bottom:8px; }
          @media print {
            body { width:100%; padding:8px; }
            .no-print { display:none !important; }
          }
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
      {/* Estilos de impresión inyectados en el head del documento */}
      <style>{`
        @media print {
          body > *:not(#baucher-ventana) { display: none !important; }
        }
      `}</style>

      <div
        className="modal"
        style={{ maxWidth: "420px", padding: 0, overflow: "hidden" }}
      >
        {/* Header del modal */}
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="modal-title">Baucher de cobro</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImprimir}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              🖨 Imprimir
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onCerrar} aria-label="Cerrar">✕</button>
          </div>
        </div>

        {/* Contenido del baucher */}
        <div
          id="baucher-contenido"
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
              PRESTAMOS & COBROS
            </div>
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              Comprobante oficial de pago
            </div>
          </div>

          {/* Número de recibo */}
          <div style={{ textAlign: "center", fontSize: "10px", color: "#888", marginBottom: "10px" }}>
            {recibo}
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
              {esParcial ? (
                <span style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: "99px",
                  fontSize: "10px", fontWeight: 700, letterSpacing: ".05em",
                  background: "#fff7e0", color: "#7a5200", border: "1px solid #ffd666",
                }}>
                  PAGO PARCIAL — FALTA {fmt(Math.abs(diferencia))}
                </span>
              ) : esAdelanto ? (
                <span style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: "99px",
                  fontSize: "10px", fontWeight: 700, letterSpacing: ".05em",
                  background: "#e6f4ff", color: "#003a8c", border: "1px solid #91caff",
                }}>
                  INCLUYE ADELANTO DE {fmt(diferencia)}
                </span>
              ) : (
                <span style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: "99px",
                  fontSize: "10px", fontWeight: 700, letterSpacing: ".05em",
                  background: "#d4f5e2", color: "#0a6637", border: "1px solid #7de0a8",
                }}>
                  ✓ CUOTA COMPLETA
                </span>
              )}
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
            {[
              ["Cliente",    cuota.cliente_nombre],
              ["Teléfono",   cuota.telefono1 ?? "—"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "11px" }}>
                <span style={{ color: "#666" }}>{lbl}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Detalle del préstamo */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".08em", color: "#555", marginBottom: "6px",
            }}>
              DETALLE DEL PRÉSTAMO
            </div>
            {[
              ["Capital",        fmt(Number(cuota.capital))],
              ["Frecuencia",     TIPO_PLAZO_LABEL[cuota.tipo_plazo] ?? cuota.tipo_plazo],
              ["Cuota #",        `${cuota.numero_cuota}`],
              ["Cuota esperada", fmt(montoEsperado)],
              ["Fecha vence",    fmtFecha(cuota.fecha_vence)],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "11px" }}>
                <span style={{ color: "#666" }}>{lbl}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
            {Number(cuota.dias_atraso) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "11px" }}>
                <span style={{ color: "#c0392b" }}>Días de atraso</span>
                <span style={{ fontWeight: 700, color: "#c0392b" }}>{cuota.dias_atraso} días</span>
              </div>
            )}
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #aaa", margin: "10px 0" }} />

          {/* Detalle del pago */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: ".08em", color: "#555", marginBottom: "6px",
            }}>
              DETALLE DEL PAGO
            </div>
            {[
              ["Fecha de pago",  fmtFecha(fechaPago)],
              ["Monto cobrado",  fmt(monto)],
              ...(esParcial  ? [["Saldo pendiente", fmt(Math.abs(diferencia))]] : []),
              ...(esAdelanto  ? [["Monto adelantado", fmt(diferencia)]] : []),
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "11px" }}>
                <span style={{ color: "#666" }}>{lbl}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "2px solid #111", margin: "10px 0" }} />

          {/* Pie */}
          <div style={{ textAlign: "center", fontSize: "9px", color: "#888", lineHeight: "1.7" }}>
            <div>Conserve este comprobante como respaldo de su pago.</div>
            <div>Generado el {new Date().toLocaleString("es-DO")}</div>
          </div>
        </div>

        {/* Acciones del modal */}
        <div
          className="modal-footer"
          style={{ borderTop: "1px solid var(--border)", gap: "8px" }}
        >
          <button className="btn btn-ghost" onClick={onCerrar}>
            Cerrar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImprimir}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            🖨 Imprimir baucher
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de cobro por cuota ────────────────────────────────────────────────
interface ModalCobroCuotaProps {
  cuota: Cuota;
  onClose: () => void;
  onConfirm: (cuotaId: string, monto: number) => Promise<void>;
}

function ModalCobroCuota({ cuota, onClose, onConfirm }: ModalCobroCuotaProps) {
  const [monto, setMonto]         = useState<number>(Number(cuota.monto_cuota));
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [baucher, setBaucher]     = useState<{ monto: number; recibo: string; fecha: string } | null>(null);

  const montoEsperado = Number(cuota.monto_cuota);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto <= 0) { setError("El monto debe ser mayor a 0"); return; }
    setError(null);
    setSaving(true);
    try {
      await onConfirm(cuota.id, monto);
      setBaucher({ monto, recibo: genRecibo(), fecha: HOY_STR });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar el cobro");
    } finally {
      setSaving(false);
    }
  };

  // Si el cobro fue exitoso, mostramos directamente el baucher
  if (baucher) {
    return (
      <BaucherCobro
        cuota={cuota}
        monto={baucher.monto}
        recibo={baucher.recibo}
        fechaPago={baucher.fecha}
        onCerrar={onClose}
      />
    );
  }

  const pct = Math.min((monto / montoEsperado) * 100, 100);
  const color =
    monto >= montoEsperado
      ? "var(--success)"
      : monto > 0
      ? "var(--warning)"
      : "var(--danger)";

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Registrar cobro</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Info resumen */}
            <div
              style={{
                background: "var(--bg-2)",
                borderRadius: "var(--radius-md)",
                padding: "0.875rem 1rem",
                marginBottom: "1.25rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
                fontSize: "0.82rem",
              }}
            >
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>
                  Cliente
                </p>
                <p style={{ fontWeight: 500 }}>{cuota.cliente_nombre}</p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>
                  Cuota #{cuota.numero_cuota} /{" "}
                  {TIPO_PLAZO_LABEL[cuota.tipo_plazo] ?? cuota.tipo_plazo}
                </p>
                <p style={{ fontWeight: 500, color: "var(--brand)" }}>
                  {fmt(montoEsperado)}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>
                  Capital préstamo
                </p>
                <p style={{ fontWeight: 500 }}>{fmt(Number(cuota.capital))}</p>
              </div>
              <div>
                <p style={{ color: "var(--text-3)", marginBottom: "2px" }}>
                  Fecha vence
                </p>
                <p
                  style={{
                    fontWeight: 500,
                    color:
                      Number(cuota.dias_atraso) > 0
                        ? "var(--danger)"
                        : "var(--text-1)",
                  }}
                >
                  {fmtFecha(cuota.fecha_vence)}
                  {Number(cuota.dias_atraso) > 0 && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--danger)",
                        marginLeft: "6px",
                      }}
                    >
                      ({cuota.dias_atraso}d atraso)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {error && (
              <div
                className="alert alert-danger"
                style={{ marginBottom: "1rem" }}
              >
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="monto-cuota">
                Monto a cobrar (DOP)
              </label>
              <input
                id="monto-cuota"
                className="form-input"
                type="number"
                min={1}
                step="0.01"
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
                placeholder="0.00"
                required
                autoFocus
              />
              {/* Accesos rápidos */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMonto(montoEsperado)}
                >
                  Cuota completa — {fmt(montoEsperado)}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMonto(Math.round(montoEsperado / 2))}
                >
                  50% — {fmt(Math.round(montoEsperado / 2))}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMonto(Math.round(montoEsperado * 2))}
                >
                  2 cuotas — {fmt(Math.round(montoEsperado * 2))}
                </button>
              </div>
            </div>

            {/* Barra de progreso */}
            {monto > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    color: "var(--text-3)",
                    marginBottom: "4px",
                  }}
                >
                  <span>Pago vs cuota esperada</span>
                  <span style={{ color, fontWeight: 500 }}>
                    {monto >= montoEsperado
                      ? "Cuota completa ✓"
                      : `Falta ${fmt(montoEsperado - monto)}`}
                  </span>
                </div>
                <div
                  style={{
                    height: "6px",
                    background: "var(--border)",
                    borderRadius: "99px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: color,
                      borderRadius: "99px",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
                {monto > montoEsperado && (
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--success)",
                      marginTop: "4px",
                    }}
                  >
                    Pago adelantado: {fmt(monto - montoEsperado)} extra
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || monto <= 0}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {saving ? "Registrando..." : `✓ Cobrar ${monto > 0 ? fmt(monto) : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export function CxCPage() {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabActiva, setTabActiva] = useState<TabActiva>("PENDIENTES");

  // Cuota seleccionada para cobro por modal
  const [cuotaACobrar, setCuotaACobrar] = useState<Cuota | null>(null);
  // Cobro rápido inline (spinner en fila) — se mantiene para compatibilidad
  const [pagando, setPagando] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cuotasData, resumenData] = await Promise.all([
        api.get<Cuota[]>("/cuotas"),
        api.get<Resumen>("/cuotas/resumen"),
      ]);
      setCuotas(cuotasData);
      setResumen(resumenData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // ── Registrar cobro desde el modal de CxC ────────────────────────────────
  // Llama al endpoint de cobros pasando el monto, luego marca la cuota como pagada.
  const registrarCobroCuota = async (cuotaId: string, monto: number) => {
    // 1. Registrar el cobro en cobros_prestamos
    const cuota = cuotas.find((c) => c.id === cuotaId);
    if (!cuota) throw new Error("Cuota no encontrada");

    await api.post(`/cobros`, {
      prestamoId: cuota.prestamo_id,
      montoPagado: monto,
    });

    // 2. Marcar la cuota como pagada
    await api.patch(`/cuotas/${cuotaId}/pagar`, {});

    // 3. Actualizar estado local
    setCuotas((prev) =>
      prev.map((c) =>
        c.id === cuotaId
          ? { ...c, estado: "PAGADO", fecha_pago: HOY_STR }
          : c
      )
    );

    // 4. Refrescar resumen
    const resumenData = await api.get<Resumen>("/cuotas/resumen");
    setResumen(resumenData);
  };

  // ── Cobro rápido (sin modal, mantiene compatibilidad anterior) ────────────
  const marcarPagada = async (cuotaId: string) => {
    setPagando(cuotaId);
    try {
      await api.patch(`/cuotas/${cuotaId}/pagar`, {});
      setCuotas((prev) =>
        prev.map((c) =>
          c.id === cuotaId
            ? { ...c, estado: "PAGADO", fecha_pago: HOY_STR }
            : c
        )
      );
      const resumenData = await api.get<Resumen>("/cuotas/resumen");
      setResumen(resumenData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrar pago");
    } finally {
      setPagando(null);
    }
  };

  // ── Filtrado por tab ──────────────────────────────────────────────────────
  const cuotasPorTab = useMemo(() => {
    const normFecha = (f: string) => f?.split("T")[0] ?? f;
    switch (tabActiva) {
      case "HOY":
        return cuotas.filter(
          (c) =>
            normFecha(c.fecha_vence) === HOY_STR && c.estado === "PENDIENTE"
        );
      case "PENDIENTES": {
        // Pendientes hasta hoy (hoy + vencidas pasadas), las de hoy primero, luego más recientes
        const pendientes = cuotas.filter(
          (c) =>
            c.estado === "PENDIENTE" && normFecha(c.fecha_vence) <= HOY_STR
        );
        return [...pendientes].sort((a, b) => {
          const aHoy = normFecha(a.fecha_vence) === HOY_STR ? 0 : 1;
          const bHoy = normFecha(b.fecha_vence) === HOY_STR ? 0 : 1;
          if (aHoy !== bHoy) return aHoy - bHoy;
          // Las más vencidas (más antiguas) al final
          return normFecha(b.fecha_vence).localeCompare(normFecha(a.fecha_vence));
        });
      }
      case "VENCIDAS":
        return cuotas.filter(
          (c) =>
            c.estado === "PENDIENTE" && normFecha(c.fecha_vence) < HOY_STR
        );
      case "PAGADAS":
        return cuotas.filter((c) => c.estado === "PAGADO");
      default:
        return cuotas;
    }
  }, [cuotas, tabActiva]);

  const cuotasF = useMemo(() => {
    return cuotasPorTab.filter((c) => {
      const q = busqueda.trim().toLowerCase();
      if (q && !c.cliente_nombre?.toLowerCase().includes(q)) return false;
      const fv = c.fecha_vence?.split("T")[0] ?? c.fecha_vence;
      if (fechaDesde && fv < fechaDesde) return false;
      if (fechaHasta && fv > fechaHasta) return false;
      const monto = Number(c.monto_cuota);
      if (montoMin !== "" && monto < Number(montoMin)) return false;
      if (montoMax !== "" && monto > Number(montoMax)) return false;
      return true;
    });
  }, [cuotasPorTab, busqueda, fechaDesde, fechaHasta, montoMin, montoMax]);

  const hayFiltros = !!(busqueda || fechaDesde || fechaHasta || montoMin || montoMax);
  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
    setMontoMin("");
    setMontoMax("");
  };

  const fechaHoy = new Date().toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tabs: { key: TabActiva; label: string; count: number; color: string }[] =
    [
      {
        key: "HOY",
        label: "Vencen hoy",
        count: resumen?.vencen_hoy ?? 0,
        color: "var(--brand)",
      },
      {
        key: "PENDIENTES",
        label: "Pendientes",
        count: resumen?.total_pendiente ?? 0,
        color: "var(--warning)",
      },
      {
        key: "VENCIDAS",
        label: "Vencidas",
        count: resumen?.vencidas ?? 0,
        color: "var(--danger)",
      },
      {
        key: "PAGADAS",
        label: "Pagadas",
        count: resumen?.total_pagadas ?? 0,
        color: "var(--success)",
      },
    ];

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

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Cuentas por Cobrar</span>
        <div className="topbar-actions">
          <span
            className="text-sm text-muted"
            style={{ marginRight: "1rem" }}
          >
            {fechaHoy}
          </span>
          <button
            className="btn btn-ghost"
            onClick={cargar}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "↻ Actualizar"}
          </button>
        </div>
      </div>

      <div className="page">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
          <div
            className="stat-card"
            style={{ borderLeft: "3px solid var(--brand)" }}
          >
            <p className="stat-label">Por cobrar hoy</p>
            <p
              className="stat-value"
              style={{ color: "var(--brand)", fontSize: "1.2rem" }}
              title={fmt(resumen?.monto_hoy ?? 0)}
            >
              {fmtCompact(resumen?.monto_hoy ?? 0)}
            </p>
            <p className="stat-sub">{resumen?.vencen_hoy ?? 0} cuotas</p>
          </div>
          <div
            className="stat-card"
            style={{ borderLeft: "3px solid var(--warning)" }}
          >
            <p className="stat-label">Total pendiente</p>
            <p
              className="stat-value"
              style={{ color: "var(--warning)", fontSize: "1.2rem" }}
              title={fmt(resumen?.monto_pendiente ?? 0)}
            >
              {fmtCompact(resumen?.monto_pendiente ?? 0)}
            </p>
            <p className="stat-sub">
              {resumen?.total_pendiente ?? 0} cuotas
            </p>
          </div>
          <div
            className="stat-card"
            style={{ borderLeft: "3px solid var(--danger)" }}
          >
            <p className="stat-label">Monto vencido</p>
            <p
              className="stat-value"
              style={{ color: "var(--danger)", fontSize: "1.2rem" }}
              title={fmt(resumen?.monto_vencido ?? 0)}
            >
              {fmtCompact(resumen?.monto_vencido ?? 0)}
            </p>
            <p className="stat-sub">
              {resumen?.vencidas ?? 0} cuotas vencidas
            </p>
          </div>
          <div
            className="stat-card"
            style={{ borderLeft: "3px solid var(--success)" }}
          >
            <p className="stat-label">Total cobrado</p>
            <p
              className="stat-value"
              style={{ color: "var(--success)", fontSize: "1.2rem" }}
              title={fmt(resumen?.monto_cobrado ?? 0)}
            >
              {fmtCompact(resumen?.monto_cobrado ?? 0)}
            </p>
            <p className="stat-sub">
              {resumen?.total_pagadas ?? 0} cuotas pagadas
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTabActiva(t.key)}
              style={{
                padding: "6px 16px",
                borderRadius: "99px",
                border: "1px solid",
                borderColor:
                  tabActiva === t.key ? t.color : "var(--border)",
                background:
                  tabActiva === t.key ? t.color : "transparent",
                color: tabActiva === t.key ? "#fff" : "var(--text-2)",
                fontWeight: tabActiva === t.key ? 600 : 400,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s",
              }}
            >
              {t.label}
              <span
                style={{
                  background:
                    tabActiva === t.key
                      ? "rgba(255,255,255,0.25)"
                      : "var(--surface-2)",
                  color:
                    tabActiva === t.key ? "#fff" : "var(--text-3)",
                  borderRadius: "99px",
                  padding: "1px 7px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          {/* Barra superior siempre visible */}
          <div
            style={{
              padding: "0.75rem 1.5rem",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Búsqueda siempre visible */}
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <input
                className="form-input"
                type="search"
                placeholder="🔍 Buscar cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Botón Filtrar */}
            <button
              className={hayFiltros && !busqueda ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              onClick={() => setFiltrosAbiertos((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                whiteSpace: "nowrap",
                borderColor: hayFiltros ? "var(--brand)" : undefined,
                color: (hayFiltros && !busqueda) ? undefined : hayFiltros ? "var(--brand)" : undefined,
              }}
            >
              <span>⚙ Filtrar</span>
              {hayFiltros && (
                <span style={{
                  background: "var(--brand)", color: "#fff",
                  borderRadius: "99px", padding: "0px 6px",
                  fontSize: "0.7rem", fontWeight: 700,
                }}>
                  {[fechaDesde, fechaHasta, montoMin, montoMax].filter(Boolean).length}
                </span>
              )}
              <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
                {filtrosAbiertos ? "▲" : "▼"}
              </span>
            </button>

            {/* Limpiar todo */}
            {hayFiltros && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={limpiarFiltros}
                style={{ whiteSpace: "nowrap", color: "var(--danger)" }}
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          {/* Panel expandible */}
          {filtrosAbiertos && (
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "1rem 1.5rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "1rem",
                background: "var(--bg-2)",
              }}
            >
              {/* Fecha desde */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="fecha-desde">
                  Fecha desde
                </label>
                <input
                  id="fecha-desde"
                  title="Desde"
                  className="form-input"
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>

              {/* Fecha hasta */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="fecha-hasta">
                  Fecha hasta
                </label>
                <input
                  id="fecha-hasta"
                  title="Hasta"
                  className="form-input"
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>

              {/* Monto mínimo */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="monto-min">
                  Monto mínimo (DOP)
                </label>
                <input
                  id="monto-min"
                  className="form-input"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="0"
                  value={montoMin}
                  onChange={(e) => setMontoMin(e.target.value)}
                />
              </div>

              {/* Monto máximo */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="monto-max">
                  Monto máximo (DOP)
                </label>
                <input
                  id="monto-max"
                  className="form-input"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="Sin límite"
                  value={montoMax}
                  onChange={(e) => setMontoMax(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Chips de filtros activos */}
          {hayFiltros && (
            <div
              style={{
                padding: "0.5rem 1.5rem",
                borderTop: "1px solid var(--border)",
                display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Filtros activos:</span>
              {busqueda && (
                <span style={chipStyle}>
                  Cliente: "{busqueda}"
                  <button style={chipBtnStyle} onClick={() => setBusqueda("")}>✕</button>
                </span>
              )}
              {fechaDesde && (
                <span style={chipStyle}>
                  Desde: {fechaDesde}
                  <button style={chipBtnStyle} onClick={() => setFechaDesde("")}>✕</button>
                </span>
              )}
              {fechaHasta && (
                <span style={chipStyle}>
                  Hasta: {fechaHasta}
                  <button style={chipBtnStyle} onClick={() => setFechaHasta("")}>✕</button>
                </span>
              )}
              {montoMin && (
                <span style={chipStyle}>
                  Monto ≥ {fmt(Number(montoMin))}
                  <button style={chipBtnStyle} onClick={() => setMontoMin("")}>✕</button>
                </span>
              )}
              {montoMax && (
                <span style={chipStyle}>
                  Monto ≤ {fmt(Number(montoMax))}
                  <button style={chipBtnStyle} onClick={() => setMontoMax("")}>✕</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {tabs.find((t) => t.key === tabActiva)?.label}
            </span>
            <span className="text-sm text-muted">
              {cuotasF.length} registros
            </span>
          </div>

          {error && (
            <div style={{ padding: "1rem 1.5rem" }}>
              <div className="alert alert-danger">{error}</div>
            </div>
          )}

          {loading && (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: "0.875rem",
              }}
            >
              Cargando cuotas...
            </div>
          )}

          {!loading && cuotasF.length === 0 && (
            <div className="empty-state">
              <p>
                {tabActiva === "HOY"
                  ? "No hay cuotas que vencen hoy."
                  : "No hay registros que coincidan."}
              </p>
              {hayFiltros && (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: "0.75rem" }}
                  onClick={limpiarFiltros}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {!loading && cuotasF.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Fecha vence</th>
                    <th>Cuota #</th>
                    <th>Frecuencia</th>
                    <th>Monto cuota</th>
                    <th>Estado</th>
                    {/* Columna de acciones siempre visible; vacía en PAGADAS */}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cuotasF.map((c) => {
                    const fechaVence =
                      c.fecha_vence?.split("T")[0] ?? c.fecha_vence;
                    const vencida =
                      c.estado === "PENDIENTE" &&
                      Number(c.dias_atraso) > 0;
                    const esHoy = fechaVence === HOY_STR;
                    const esPagando = pagando === c.id;

                    return (
                      <tr
                        key={c.id}
                        style={
                          vencida
                            ? { background: "var(--danger-bg)" }
                            : esHoy
                            ? { background: "#fffbe6", outline: "1px solid #ffe58f" }
                            : {}
                        }
                      >
                        {/* Cliente */}
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              className="avatar"
                              style={{
                                width: "30px",
                                height: "30px",
                                fontSize: "0.7rem",
                              }}
                            >
                              {(c.cliente_nombre ?? "?")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <span className="font-medium">
                              {c.cliente_nombre}
                            </span>
                          </div>
                        </td>

                        {/* Teléfono */}
                        <td
                          className="text-muted"
                          style={{ fontSize: "0.82rem" }}
                        >
                          <div>{c.telefono1 ?? "—"}</div>
                          {c.telefono2 && (
                            <div style={{ color: "var(--text-3)" }}>
                              {c.telefono2}
                            </div>
                          )}
                        </td>

                        {/* Fecha vence */}
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontWeight: esHoy ? 600 : 400,
                              color: vencida
                                ? "var(--danger)"
                                : esHoy
                                ? "var(--brand)"
                                : "var(--text-2)",
                            }}
                          >
                            {fmtFecha(fechaVence)}
                          </span>
                          {vencida && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                color:
                                  Number(c.dias_atraso) > 30
                                    ? "var(--danger)"
                                    : "var(--warning)",
                                marginLeft: "6px",
                              }}
                            >
                              {c.dias_atraso}d atraso
                            </span>
                          )}
                          {c.estado === "PAGADO" && c.fecha_pago && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--success)",
                                marginTop: "2px",
                              }}
                            >
                              Pagado: {fmtFecha(c.fecha_pago)}
                            </div>
                          )}
                        </td>

                        {/* Número cuota */}
                        <td
                          className="text-muted"
                          style={{ textAlign: "center" }}
                        >
                          #{c.numero_cuota}
                        </td>

                        {/* Frecuencia */}
                        <td style={{ fontSize: "0.82rem" }}>
                          <span
                            style={{
                              color: "var(--brand)",
                              background: "var(--brand-light)",
                              padding: "2px 8px",
                              borderRadius: "99px",
                              fontSize: "0.75rem",
                              fontWeight: 500,
                            }}
                          >
                            {TIPO_PLAZO_LABEL[c.tipo_plazo] ?? c.tipo_plazo}
                          </span>
                        </td>

                        {/* Monto */}
                        <td
                          style={{
                            fontWeight: 600,
                            color: "var(--brand)",
                          }}
                        >
                          {fmt(Number(c.monto_cuota))}
                        </td>

                        {/* Estado badge */}
                        <td>
                          {c.estado === "PAGADO" ? (
                            <span className="badge badge-success">
                              Pagado
                            </span>
                          ) : vencida ? (
                            <span className="badge badge-danger">
                              Vencida
                            </span>
                          ) : esHoy ? (
                            <span
                              className="badge"
                              style={{
                                background: "#faad14",
                                color: "#fff",
                                fontWeight: 700,
                              }}
                            >
                              ⚡ Vence hoy
                            </span>
                          ) : (
                            <span className="badge badge-warning">
                              Pendiente
                            </span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td>
                          {c.estado !== "PAGADO" && (
                            <div style={{ display: "flex", gap: "6px" }}>
                              {/*
                               * Botón principal → abre el modal de cobro
                               * (registra en cobros_prestamos + marca cuota pagada)
                               */}
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => setCuotaACobrar(c)}
                                disabled={esPagando}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                💰 Cobrar
                              </button>

                              {/*
                               * Botón secundario → cobro rápido sin modal
                               * (solo marca cuota como pagada, monto exacto)
                               */}
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => marcarPagada(c.id)}
                                disabled={esPagando}
                                title="Marcar pagada sin registrar monto"
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {esPagando ? "..." : "✓"}
                              </button>
                            </div>
                          )}
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

      {/* Modal de cobro por cuota */}
      {cuotaACobrar && (
        <ModalCobroCuota
          cuota={cuotaACobrar}
          onClose={() => setCuotaACobrar(null)}
          onConfirm={registrarCobroCuota}
        />
      )}
    </>
  );
}