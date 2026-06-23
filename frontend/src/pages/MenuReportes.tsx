import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import type { EstadoPrestamo, TipoPlazo } from "../types";

// ─── Utilidades ───────────────────────────────────────────────────────────────
function fmt(n: number) {
  return Number(n).toLocaleString("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  });
}

function fmtFecha(f: string | null) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function imprimir() {
  window.print();
}

// ─── Tipos internos ───────────────────────────────────────────────────────────
interface FiltroPeriodo {
  desde: string;
  hasta: string;
}

interface OpcBase {
  id: string;
  nombre?: string;
  label?: string;
}

interface CatalogoState {
  clientes: OpcBase[];
  usuarios: OpcBase[];
  sucursales: OpcBase[];
  oficiales: OpcBase[];
  cobradores: OpcBase[];
  tiposPrestamo: OpcBase[];
  zonas: OpcBase[];
}

// ─── Definición de categorías y reportes ──────────────────────────────────────
interface ReporteItem {
  id: string;
  nombre: string;
  endpoint: string;
  /** Qué filtros mostrar: fecha | cliente | usuario | sucursal | oficial | cobrador | tipo | zona | prestamo | estado | rango_mora | top | agrupacion */
  filtros: string[];
  csvFilename: string;
}

interface Categoria {
  id: string;
  label: string;
  icono: string;
  color: string;
  reportes: ReporteItem[];
}

const CATEGORIAS: Categoria[] = [
  {
    id: "cartera",
    label: "Cartera de préstamos",
    icono: "💼",
    color: "var(--brand)",
    reportes: [
      { id: "cartera-general",   nombre: "Reporte general de cartera",       endpoint: "/reportes/cartera/general",     filtros: ["fecha", "sucursal", "oficial", "tipo"],    csvFilename: "cartera-general.csv" },
      { id: "cartera-activa",    nombre: "Cartera activa",                    endpoint: "/reportes/cartera/activa",      filtros: ["fecha", "sucursal", "oficial"],            csvFilename: "cartera-activa.csv" },
      { id: "cartera-vencida",   nombre: "Cartera vencida",                   endpoint: "/reportes/cartera/vencida",     filtros: ["fecha", "sucursal", "rango_mora"],         csvFilename: "cartera-vencida.csv" },
      { id: "cartera-castigada", nombre: "Cartera castigada",                 endpoint: "/reportes/cartera/castigada",   filtros: ["fecha", "sucursal"],                       csvFilename: "cartera-castigada.csv" },
      { id: "cartera-tipo",      nombre: "Cartera por tipo de préstamo",      endpoint: "/reportes/cartera/por-tipo",    filtros: ["fecha", "tipo"],                           csvFilename: "cartera-por-tipo.csv" },
      { id: "cartera-sucursal",  nombre: "Cartera por sucursal",              endpoint: "/reportes/cartera/por-sucursal",filtros: ["fecha", "sucursal"],                       csvFilename: "cartera-por-sucursal.csv" },
      { id: "cartera-oficial",   nombre: "Cartera por oficial de crédito",    endpoint: "/reportes/cartera/por-oficial", filtros: ["fecha", "oficial"],                        csvFilename: "cartera-por-oficial.csv" },
      { id: "cartera-zona",      nombre: "Cartera por zona geográfica",       endpoint: "/reportes/cartera/por-zona",    filtros: ["fecha", "zona"],                           csvFilename: "cartera-por-zona.csv" },
    ],
  },
  {
    id: "prestamos",
    label: "Préstamos",
    icono: "📋",
    color: "#0F6E56",
    reportes: [
      { id: "prest-activos",       nombre: "Préstamos activos",        endpoint: "/reportes/prestamos/activos",        filtros: ["fecha", "cliente", "oficial", "tipo"],      csvFilename: "prestamos-activos.csv" },
      { id: "prest-finalizados",   nombre: "Préstamos finalizados",    endpoint: "/reportes/prestamos/finalizados",    filtros: ["fecha", "cliente", "oficial"],              csvFilename: "prestamos-finalizados.csv" },
      { id: "prest-refinanciados", nombre: "Préstamos refinanciados",  endpoint: "/reportes/prestamos/refinanciados",  filtros: ["fecha", "cliente"],                         csvFilename: "prestamos-refinanciados.csv" },
      { id: "prest-reestruc",      nombre: "Préstamos reestructurados",endpoint: "/reportes/prestamos/reestructurados",filtros: ["fecha", "cliente"],                         csvFilename: "prestamos-reestructurados.csv" },
      { id: "prest-periodo",       nombre: "Préstamos por período",    endpoint: "/reportes/prestamos/por-periodo",    filtros: ["fecha", "tipo", "sucursal"],                csvFilename: "prestamos-por-periodo.csv" },
      { id: "prest-historial",     nombre: "Historial de préstamos",   endpoint: "/reportes/prestamos/historial",      filtros: ["fecha", "cliente", "prestamo"],             csvFilename: "prestamos-historial.csv" },
    ],
  },
  {
    id: "solicitudes",
    label: "Solicitudes",
    icono: "📝",
    color: "#854F0B",
    reportes: [
      { id: "sol-registradas", nombre: "Solicitudes registradas", endpoint: "/reportes/solicitudes/registradas", filtros: ["fecha", "estado", "oficial"], csvFilename: "solicitudes-registradas.csv" },
      { id: "sol-pendientes",  nombre: "Solicitudes pendientes",  endpoint: "/reportes/solicitudes/pendientes",  filtros: ["fecha", "oficial"],           csvFilename: "solicitudes-pendientes.csv" },
      { id: "sol-aprobadas",   nombre: "Solicitudes aprobadas",   endpoint: "/reportes/solicitudes/aprobadas",   filtros: ["fecha", "oficial"],           csvFilename: "solicitudes-aprobadas.csv" },
      { id: "sol-rechazadas",  nombre: "Solicitudes rechazadas",  endpoint: "/reportes/solicitudes/rechazadas",  filtros: ["fecha", "oficial"],           csvFilename: "solicitudes-rechazadas.csv" },
      { id: "sol-canceladas",  nombre: "Solicitudes canceladas",  endpoint: "/reportes/solicitudes/canceladas",  filtros: ["fecha", "oficial"],           csvFilename: "solicitudes-canceladas.csv" },
    ],
  },
  {
    id: "desembolsos",
    label: "Desembolsos",
    icono: "💸",
    color: "var(--brand)",
    reportes: [
      { id: "desemb-fecha",    nombre: "Desembolsos por fecha",    endpoint: "/reportes/desembolsos/por-fecha",    filtros: ["fecha", "sucursal"],  csvFilename: "desembolsos-fecha.csv" },
      { id: "desemb-cliente",  nombre: "Desembolsos por cliente",  endpoint: "/reportes/desembolsos/por-cliente",  filtros: ["fecha", "cliente"],   csvFilename: "desembolsos-cliente.csv" },
      { id: "desemb-oficial",  nombre: "Desembolsos por oficial",  endpoint: "/reportes/desembolsos/por-oficial",  filtros: ["fecha", "oficial"],   csvFilename: "desembolsos-oficial.csv" },
      { id: "desemb-sucursal", nombre: "Desembolsos por sucursal", endpoint: "/reportes/desembolsos/por-sucursal", filtros: ["fecha", "sucursal"],  csvFilename: "desembolsos-sucursal.csv" },
    ],
  },
  {
    id: "cobros",
    label: "Cobros y pagos",
    icono: "💰",
    color: "#0F6E56",
    reportes: [
      { id: "cobros-recibidos",  nombre: "Cobros recibidos",          endpoint: "/reportes/cobros/recibidos",       filtros: ["fecha", "cliente", "metodo_pago"],   csvFilename: "cobros-recibidos.csv" },
      { id: "pagos-parciales",   nombre: "Pagos parciales",           endpoint: "/reportes/cobros/parciales",       filtros: ["fecha", "cliente"],                  csvFilename: "pagos-parciales.csv" },
      { id: "pagos-completos",   nombre: "Pagos completos",           endpoint: "/reportes/cobros/completos",       filtros: ["fecha", "cliente"],                  csvFilename: "pagos-completos.csv" },
      { id: "pagos-anticipados", nombre: "Pagos anticipados",         endpoint: "/reportes/cobros/anticipados",     filtros: ["fecha", "cliente"],                  csvFilename: "pagos-anticipados.csv" },
      { id: "pagos-metodo",      nombre: "Pagos por método de pago",  endpoint: "/reportes/cobros/por-metodo",      filtros: ["fecha", "metodo_pago"],              csvFilename: "pagos-por-metodo.csv" },
      { id: "historial-pagos",   nombre: "Historial de pagos",        endpoint: "/reportes/cobros/historial",       filtros: ["fecha", "cliente", "prestamo"],      csvFilename: "historial-pagos.csv" },
    ],
  },
  {
    id: "cuotas",
    label: "Cuotas",
    icono: "📅",
    color: "#534AB7",
    reportes: [
      { id: "cuotas-pendientes",  nombre: "Cuotas pendientes",      endpoint: "/reportes/cuotas/pendientes",       filtros: ["fecha", "cliente", "prestamo"],  csvFilename: "cuotas-pendientes.csv" },
      { id: "cuotas-pagadas",     nombre: "Cuotas pagadas",         endpoint: "/reportes/cuotas/pagadas",          filtros: ["fecha", "cliente"],              csvFilename: "cuotas-pagadas.csv" },
      { id: "cuotas-vencidas",    nombre: "Cuotas vencidas",        endpoint: "/reportes/cuotas/vencidas",         filtros: ["fecha", "rango_mora", "cliente"], csvFilename: "cuotas-vencidas.csv" },
      { id: "prox-vencimientos",  nombre: "Próximos vencimientos",  endpoint: "/reportes/cuotas/proximos",         filtros: ["fecha", "sucursal"],             csvFilename: "proximos-vencimientos.csv" },
    ],
  },
  {
    id: "morosidad",
    label: "Morosidad",
    icono: "⚠️",
    color: "var(--danger)",
    reportes: [
      { id: "clientes-morosos",   nombre: "Clientes morosos",                endpoint: "/reportes/morosidad/clientes",   filtros: ["fecha", "rango_mora", "zona"],  csvFilename: "clientes-morosos.csv" },
      { id: "cuotas-mora",        nombre: "Cuotas en mora",                  endpoint: "/reportes/morosidad/cuotas",     filtros: ["fecha", "rango_mora"],          csvFilename: "cuotas-en-mora.csv" },
      { id: "mora-acumulada",     nombre: "Mora acumulada",                  endpoint: "/reportes/morosidad/acumulada",  filtros: ["fecha", "sucursal", "oficial"], csvFilename: "mora-acumulada.csv" },
      { id: "morosidad-rangos",   nombre: "Morosidad por rangos de días",    endpoint: "/reportes/morosidad/por-rangos", filtros: ["fecha", "sucursal"],            csvFilename: "morosidad-rangos.csv" },
      { id: "ranking-morosos",    nombre: "Ranking de morosos",              endpoint: "/reportes/morosidad/ranking",    filtros: ["fecha", "top"],                 csvFilename: "ranking-morosos.csv" },
    ],
  },
  {
    id: "cobranza",
    label: "Cobranza",
    icono: "📞",
    color: "#854F0B",
    reportes: [
      { id: "gestion-cobranza",   nombre: "Gestión de cobranza",              endpoint: "/reportes/cobranza/gestion",       filtros: ["fecha", "cobrador", "estado"],  csvFilename: "gestion-cobranza.csv" },
      { id: "promesas-pago",      nombre: "Promesas de pago",                  endpoint: "/reportes/cobranza/promesas",      filtros: ["fecha", "cobrador", "cliente"], csvFilename: "promesas-pago.csv" },
      { id: "recuperacion",       nombre: "Recuperación de cartera",           endpoint: "/reportes/cobranza/recuperacion",  filtros: ["fecha", "sucursal"],            csvFilename: "recuperacion-cartera.csv" },
      { id: "recuperacion-cast",  nombre: "Recuperación de cartera castigada", endpoint: "/reportes/cobranza/recuperacion-castigada", filtros: ["fecha", "sucursal"], csvFilename: "recuperacion-castigada.csv" },
      { id: "gestion-cobrador",   nombre: "Gestión por cobrador",              endpoint: "/reportes/cobranza/por-cobrador", filtros: ["fecha", "cobrador"],            csvFilename: "gestion-cobrador.csv" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icono: "👥",
    color: "var(--brand)",
    reportes: [
      { id: "clientes-activos",   nombre: "Clientes activos",     endpoint: "/reportes/clientes/activos",   filtros: ["fecha", "zona", "oficial"],      csvFilename: "clientes-activos.csv" },
      { id: "clientes-inactivos", nombre: "Clientes inactivos",   endpoint: "/reportes/clientes/inactivos", filtros: ["fecha", "zona"],                 csvFilename: "clientes-inactivos.csv" },
      { id: "clientes-nuevos",    nombre: "Clientes nuevos",      endpoint: "/reportes/clientes/nuevos",    filtros: ["fecha", "zona", "oficial"],      csvFilename: "clientes-nuevos.csv" },
      { id: "clientes-morosos2",  nombre: "Clientes morosos",     endpoint: "/reportes/clientes/morosos",   filtros: ["fecha", "rango_mora", "zona"],   csvFilename: "clientes-morosos-c.csv" },
      { id: "historial-cliente",  nombre: "Historial del cliente", endpoint: "/reportes/clientes/historial", filtros: ["cliente", "fecha"],             csvFilename: "historial-cliente.csv" },
    ],
  },
  {
    id: "intereses",
    label: "Intereses y mora",
    icono: "📊",
    color: "#0F6E56",
    reportes: [
      { id: "int-generados",  nombre: "Intereses generados",  endpoint: "/reportes/intereses/generados",  filtros: ["fecha", "tipo", "sucursal"],  csvFilename: "intereses-generados.csv" },
      { id: "int-cobrados",   nombre: "Intereses cobrados",   endpoint: "/reportes/intereses/cobrados",   filtros: ["fecha", "sucursal"],          csvFilename: "intereses-cobrados.csv" },
      { id: "int-pendientes", nombre: "Intereses pendientes", endpoint: "/reportes/intereses/pendientes", filtros: ["fecha", "sucursal"],          csvFilename: "intereses-pendientes.csv" },
      { id: "mora-generada",  nombre: "Mora generada",        endpoint: "/reportes/mora/generada",        filtros: ["fecha", "sucursal"],          csvFilename: "mora-generada.csv" },
      { id: "mora-cobrada",   nombre: "Mora cobrada",         endpoint: "/reportes/mora/cobrada",         filtros: ["fecha", "sucursal"],          csvFilename: "mora-cobrada.csv" },
      { id: "mora-pendiente", nombre: "Mora pendiente",       endpoint: "/reportes/mora/pendiente",       filtros: ["fecha", "rango_mora", "sucursal"], csvFilename: "mora-pendiente.csv" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icono: "📈",
    color: "#534AB7",
    reportes: [
      { id: "flujo-caja",    nombre: "Flujo de caja",         endpoint: "/reportes/finanzas/flujo-caja",    filtros: ["fecha", "sucursal", "agrupacion"], csvFilename: "flujo-caja.csv" },
      { id: "ingresos-fin",  nombre: "Ingresos financieros",  endpoint: "/reportes/finanzas/ingresos",       filtros: ["fecha", "sucursal"],              csvFilename: "ingresos-financieros.csv" },
      { id: "egresos",       nombre: "Egresos",               endpoint: "/reportes/finanzas/egresos",        filtros: ["fecha", "sucursal"],              csvFilename: "egresos.csv" },
      { id: "utilidad-neta", nombre: "Utilidad neta",         endpoint: "/reportes/finanzas/utilidad",       filtros: ["fecha", "sucursal"],              csvFilename: "utilidad-neta.csv" },
      { id: "rentabilidad",  nombre: "Rentabilidad",          endpoint: "/reportes/finanzas/rentabilidad",   filtros: ["fecha", "sucursal"],              csvFilename: "rentabilidad.csv" },
    ],
  },
  {
    id: "comisiones",
    label: "Comisiones",
    icono: "🧾",
    color: "#854F0B",
    reportes: [
      { id: "com-oficial",  nombre: "Comisiones por oficial",  endpoint: "/reportes/comisiones/por-oficial",  filtros: ["fecha", "oficial"],   csvFilename: "comisiones-oficial.csv" },
      { id: "com-cobrador", nombre: "Comisiones por cobrador", endpoint: "/reportes/comisiones/por-cobrador", filtros: ["fecha", "cobrador"],  csvFilename: "comisiones-cobrador.csv" },
      { id: "com-periodo",  nombre: "Comisiones por período",  endpoint: "/reportes/comisiones/por-periodo",  filtros: ["fecha", "sucursal"],  csvFilename: "comisiones-periodo.csv" },
    ],
  },
  {
    id: "riesgo",
    label: "Riesgo crediticio",
    icono: "🛡️",
    color: "var(--danger)",
    reportes: [
      { id: "indicadores-riesgo", nombre: "Indicadores de riesgo",   endpoint: "/reportes/riesgo/indicadores",     filtros: ["fecha", "sucursal"],           csvFilename: "indicadores-riesgo.csv" },
      { id: "nivel-morosidad",    nombre: "Nivel de morosidad",      endpoint: "/reportes/riesgo/morosidad",       filtros: ["fecha", "sucursal"],           csvFilename: "nivel-morosidad.csv" },
      { id: "capacidad-pago",     nombre: "Capacidad de pago",       endpoint: "/reportes/riesgo/capacidad-pago",  filtros: ["cliente", "fecha"],            csvFilename: "capacidad-pago.csv" },
      { id: "alto-riesgo",        nombre: "Clientes de alto riesgo", endpoint: "/reportes/riesgo/alto-riesgo",     filtros: ["fecha", "zona"],               csvFilename: "clientes-alto-riesgo.csv" },
    ],
  },
  {
    id: "auditoria",
    label: "Auditoría",
    icono: "🔒",
    color: "#444441",
    reportes: [
      { id: "actividad-usuarios",  nombre: "Actividad de usuarios",       endpoint: "/reportes/auditoria/usuarios",      filtros: ["fecha", "usuario"],        csvFilename: "actividad-usuarios.csv" },
      { id: "transacciones-sis",   nombre: "Transacciones del sistema",   endpoint: "/reportes/auditoria/transacciones",  filtros: ["fecha", "tipo_tx"],       csvFilename: "transacciones-sistema.csv" },
      { id: "cambios-prestamos",   nombre: "Cambios en préstamos",        endpoint: "/reportes/auditoria/cambios",        filtros: ["fecha", "prestamo", "usuario"], csvFilename: "cambios-prestamos.csv" },
      { id: "registro-accesos",    nombre: "Registro de accesos",         endpoint: "/reportes/auditoria/accesos",        filtros: ["fecha", "usuario"],        csvFilename: "registro-accesos.csv" },
      { id: "bitacora",            nombre: "Bitácora de auditoría",       endpoint: "/reportes/auditoria/bitacora",       filtros: ["fecha", "usuario", "accion"], csvFilename: "bitacora.csv" },
    ],
  },
  {
    id: "gerencial",
    label: "Reportes gerenciales",
    icono: "📊",
    color: "#534AB7",
    reportes: [
      { id: "dashboard-ejec",  nombre: "Dashboard ejecutivo",           endpoint: "/reportes/gerencial/dashboard",     filtros: ["fecha", "sucursal"],          csvFilename: "dashboard-ejecutivo.csv" },
      { id: "kpi",             nombre: "Indicadores KPI",               endpoint: "/reportes/gerencial/kpi",           filtros: ["fecha", "sucursal"],          csvFilename: "kpi.csv" },
      { id: "comp-mensual",    nombre: "Comparativo mensual",           endpoint: "/reportes/gerencial/comp-mensual",  filtros: ["agrupacion", "sucursal"],     csvFilename: "comparativo-mensual.csv" },
      { id: "comp-anual",      nombre: "Comparativo anual",             endpoint: "/reportes/gerencial/comp-anual",    filtros: ["agrupacion", "sucursal"],     csvFilename: "comparativo-anual.csv" },
      { id: "metas",           nombre: "Cumplimiento de metas",         endpoint: "/reportes/gerencial/metas",         filtros: ["fecha", "oficial", "sucursal"],csvFilename: "cumplimiento-metas.csv" },
      { id: "resumen-consol",  nombre: "Resumen financiero consolidado",endpoint: "/reportes/gerencial/consolidado",   filtros: ["fecha", "sucursal"],          csvFilename: "resumen-consolidado.csv" },
    ],
  },
];

// ─── Hook catálogos ───────────────────────────────────────────────────────────
function useCatalogos(): CatalogoState {
  const [state, setState] = useState<CatalogoState>({
    clientes: [], usuarios: [], sucursales: [],
    oficiales: [], cobradores: [], tiposPrestamo: [], zonas: [],
  });

  useEffect(() => {
    api.get<any[]>("/clientes").then((data) =>
      setState((s) => ({
        ...s,
        clientes: data.map((c) => ({
          id: c.id,
          nombre: `${c.nombres} ${c.apellidos}`,
        })),
      }))
    ).catch(() => {});

    api.get<any[]>("/usuarios").then((data) =>
      setState((s) => ({
        ...s,
        usuarios:  data.filter((u) => !u.rol || u.rol !== "COBRADOR").map((u) => ({ id: u.id, nombre: u.nombre ?? u.username })),
        oficiales: data.filter((u) => u.rol === "OFICIAL" || u.rol === "ADMIN").map((u) => ({ id: u.id, nombre: u.nombre ?? u.username })),
        cobradores:data.filter((u) => u.rol === "COBRADOR").map((u) => ({ id: u.id, nombre: u.nombre ?? u.username })),
      }))
    ).catch(() => {});

    // Catálogos opcionales — no bloquean si no existen en el backend todavía
    api.get<any[]>("/sucursales").then((data) =>
      setState((s) => ({ ...s, sucursales: data.map((x) => ({ id: x.id, nombre: x.nombre })) }))
    ).catch(() => {});

    api.get<any[]>("/zonas").then((data) =>
      setState((s) => ({ ...s, zonas: data.map((x) => ({ id: x.id, nombre: x.nombre })) }))
    ).catch(() => {});

    setState((s) => ({
      ...s,
      tiposPrestamo: [
        { id: "PERSONAL",    nombre: "Personal" },
        { id: "COMERCIAL",   nombre: "Comercial" },
        { id: "HIPOTECARIO", nombre: "Hipotecario" },
        { id: "MICROCREDITO",nombre: "Microcrédito" },
      ],
    }));
  }, []);

  return state;
}

// ─── Componente SelectFiltro (reutiliza el patrón de ReportesPage) ────────────
function SelectFiltro({
  id, label, value, onChange, options, placeholder = "— Todos —",
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void;
  options: OpcBase[];
  placeholder?: string;
}) {
  return (
    <div className="form-group" style={{ marginBottom: 0, minWidth: "160px", flex: "1 1 160px" }}>
      <label className="form-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        title={label}
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre ?? o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Componente FiltroFecha (patrón de ReportesPage) ─────────────────────────
function FiltroFecha({
  filtro, onChange,
}: {
  filtro: FiltroPeriodo;
  onChange: (f: FiltroPeriodo) => void;
}) {
  const hoy  = new Date().toISOString().split("T")[0];
  const mes1 = hoy.slice(0, 7) + "-01";
  const año1 = hoy.slice(0, 4) + "-01-01";

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1rem" }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="mr-desde">Desde</label>
        <input
          id="mr-desde"
          title="Desde"
          className="form-input"
          type="date"
          value={filtro.desde}
          onChange={(e) => onChange({ ...filtro, desde: e.target.value })}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="mr-hasta">Hasta</label>
        <input
          id="mr-hasta"
          title="Hasta"
          className="form-input"
          type="date"
          value={filtro.hasta}
          onChange={(e) => onChange({ ...filtro, hasta: e.target.value })}
        />
      </div>
      <div style={{ display: "flex", gap: "6px", alignSelf: "flex-end", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: hoy, hasta: hoy })}>Hoy</button>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const lun = new Date();
          lun.setDate(lun.getDate() - lun.getDay() + 1);
          onChange({ desde: lun.toISOString().split("T")[0], hasta: hoy });
        }}>Esta semana</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: mes1, hasta: hoy })}>Este mes</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: año1, hasta: hoy })}>Este año</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ desde: "", hasta: "" })}>Todo</button>
      </div>
    </div>
  );
}

// ─── Ventana modal de filtros y resultado por reporte ─────────────────────────
function VentanaReporte({
  reporte,
  catalogos,
  onCerrar,
}: {
  reporte: ReporteItem;
  catalogos: CatalogoState;
  onCerrar: () => void;
}) {
  const f = reporte.filtros;

  // Estados de filtros
  const [filtro,     setFiltro]     = useState<FiltroPeriodo>({ desde: "", hasta: "" });
  const [clienteId,  setClienteId]  = useState("");
  const [usuarioId,  setUsuarioId]  = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [oficialId,  setOficialId]  = useState("");
  const [cobradorId, setCobradorId] = useState("");
  const [tipoId,     setTipoId]     = useState("");
  const [zonaId,     setZonaId]     = useState("");
  const [prestamoId, setPrestamoId] = useState("");
  const [estadoVal,  setEstadoVal]  = useState("");
  const [rangMora,   setRangMora]   = useState("");
  const [topVal,     setTopVal]     = useState("10");
  const [agrupacion, setAgrupacion] = useState("MES");
  const [accionVal,  setAccionVal]  = useState("");
  const [tipoTxVal,  setTipoTxVal]  = useState("");
  const [metodoVal,  setMetodoVal]  = useState("");

  // Estado resultado
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const resultadoRef = useRef<HTMLDivElement>(null);

  const buscar = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams();
      if (f.includes("fecha")) {
        if (filtro.desde) params.append("desde", filtro.desde);
        if (filtro.hasta) params.append("hasta", filtro.hasta);
      }
      if (f.includes("cliente")    && clienteId)  params.append("clienteId",  clienteId);
      if (f.includes("usuario")    && usuarioId)   params.append("usuarioId",  usuarioId);
      if (f.includes("sucursal")   && sucursalId)  params.append("sucursalId", sucursalId);
      if (f.includes("oficial")    && oficialId)   params.append("oficialId",  oficialId);
      if (f.includes("cobrador")   && cobradorId)  params.append("cobradorId", cobradorId);
      if (f.includes("tipo")       && tipoId)      params.append("tipo",       tipoId);
      if (f.includes("zona")       && zonaId)      params.append("zonaId",     zonaId);
      if (f.includes("prestamo")   && prestamoId)  params.append("prestamoId", prestamoId);
      if (f.includes("estado")     && estadoVal)   params.append("estado",     estadoVal);
      if (f.includes("rango_mora") && rangMora)    params.append("rangoMora",  rangMora);
      if (f.includes("top"))                       params.append("top",        topVal);
      if (f.includes("agrupacion"))                params.append("agrupacion", agrupacion);
      if (f.includes("accion")     && accionVal)   params.append("accion",     accionVal);
      if (f.includes("tipo_tx")    && tipoTxVal)   params.append("tipoTx",     tipoTxVal);
      if (f.includes("metodo_pago")&& metodoVal)   params.append("metodoPago", metodoVal);

      const result = await api.get<any>(`${reporte.endpoint}?${params}`);
      setData(result);
      setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    } catch (e: any) {
      setError(e.message ?? "Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  // Filas para CSV: soporta array directo o data.detalle / data.data / data.items
  const filasCSV: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data?.detalle ?? data?.data ?? data?.items ?? data?.rows ?? [];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      paddingTop: "3rem",
      paddingBottom: "2rem",
      overflowY: "auto",
    }}>
      <div style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        width: "min(780px, 96vw)",
        maxHeight: "calc(100vh - 5rem)",
        overflowY: "auto",
        padding: "1.5rem",
      }}>
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
            {reporte.nombre}
          </h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onCerrar}
            style={{ fontWeight: 600 }}
          >
            ✕ Cerrar
          </button>
        </div>

        {/* ── Filtros ── */}
        <div style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "1rem",
          marginBottom: "1.25rem",
        }}>
          {/* Fecha */}
          {f.includes("fecha") && (
            <FiltroFecha filtro={filtro} onChange={setFiltro} />
          )}

          {/* Agrupación (comparativos gerenciales) */}
          {f.includes("agrupacion") && (
            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <label className="form-label">Agrupación</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {["DIA", "SEMANA", "MES", "TRIMESTRE", "AÑO"].map((op) => (
                  <button
                    key={op}
                    className={`btn btn-sm ${agrupacion === op ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setAgrupacion(op)}
                    style={{ fontSize: "0.78rem" }}
                  >
                    {op.charAt(0) + op.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fila principal de selectores */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            {f.includes("cliente") && (
              <SelectFiltro
                id="mr-cliente" label="Cliente"
                value={clienteId} onChange={setClienteId}
                options={catalogos.clientes}
                placeholder="— Todos los clientes —"
              />
            )}
            {f.includes("prestamo") && (
              <SelectFiltro
                id="mr-prestamo" label="No. Préstamo"
                value={prestamoId} onChange={setPrestamoId}
                options={[]} /* Cargado bajo demanda según cliente */
                placeholder="— Todos los préstamos —"
              />
            )}
            {f.includes("sucursal") && (
              <SelectFiltro
                id="mr-sucursal" label="Sucursal"
                value={sucursalId} onChange={setSucursalId}
                options={catalogos.sucursales.length ? catalogos.sucursales : [
                  { id: "CENTRAL", nombre: "Central" },
                  { id: "NORTE",   nombre: "Norte" },
                  { id: "SUR",     nombre: "Sur" },
                  { id: "ESTE",    nombre: "Este" },
                  { id: "OESTE",   nombre: "Oeste" },
                ]}
                placeholder="— Todas las sucursales —"
              />
            )}
            {f.includes("oficial") && (
              <SelectFiltro
                id="mr-oficial" label="Oficial de crédito"
                value={oficialId} onChange={setOficialId}
                options={catalogos.oficiales.length ? catalogos.oficiales : catalogos.usuarios}
                placeholder="— Todos los oficiales —"
              />
            )}
            {f.includes("cobrador") && (
              <SelectFiltro
                id="mr-cobrador" label="Cobrador"
                value={cobradorId} onChange={setCobradorId}
                options={catalogos.cobradores.length ? catalogos.cobradores : catalogos.usuarios}
                placeholder="— Todos los cobradores —"
              />
            )}
            {f.includes("usuario") && (
              <SelectFiltro
                id="mr-usuario" label="Usuario"
                value={usuarioId} onChange={setUsuarioId}
                options={catalogos.usuarios}
                placeholder="— Todos los usuarios —"
              />
            )}
            {f.includes("tipo") && (
              <SelectFiltro
                id="mr-tipo" label="Tipo de préstamo"
                value={tipoId} onChange={setTipoId}
                options={catalogos.tiposPrestamo}
                placeholder="— Todos los tipos —"
              />
            )}
            {f.includes("zona") && (
              <SelectFiltro
                id="mr-zona" label="Zona geográfica"
                value={zonaId} onChange={setZonaId}
                options={catalogos.zonas.length ? catalogos.zonas : [
                  { id: "NORTE",   nombre: "Norte" },
                  { id: "SUR",     nombre: "Sur" },
                  { id: "ESTE",    nombre: "Este" },
                  { id: "OESTE",   nombre: "Oeste" },
                  { id: "CENTRAL", nombre: "Central" },
                ]}
                placeholder="— Todas las zonas —"
              />
            )}
            {f.includes("estado") && (
              <SelectFiltro
                id="mr-estado" label="Estado"
                value={estadoVal} onChange={setEstadoVal}
                options={[
                  { id: "PENDIENTE", nombre: "Pendiente" },
                  { id: "APROBADO",  nombre: "Aprobado" },
                  { id: "ACTIVO",    nombre: "Activo" },
                  { id: "RECHAZADO", nombre: "Rechazado" },
                  { id: "CANCELADO", nombre: "Cancelado" },
                  { id: "PAGADO",    nombre: "Pagado" },
                ]}
              />
            )}
            {f.includes("rango_mora") && (
              <SelectFiltro
                id="mr-rango" label="Rango de mora"
                value={rangMora} onChange={setRangMora}
                options={[
                  { id: "1-30",  nombre: "1 – 30 días" },
                  { id: "31-60", nombre: "31 – 60 días" },
                  { id: "61-90", nombre: "61 – 90 días" },
                  { id: "90+",   nombre: "Más de 90 días" },
                ]}
              />
            )}
            {f.includes("top") && (
              <SelectFiltro
                id="mr-top" label="Mostrar top"
                value={topVal} onChange={setTopVal}
                options={[
                  { id: "10",  nombre: "Top 10" },
                  { id: "20",  nombre: "Top 20" },
                  { id: "50",  nombre: "Top 50" },
                  { id: "100", nombre: "Top 100" },
                  { id: "0",   nombre: "Todos" },
                ]}
              />
            )}
            {f.includes("metodo_pago") && (
              <SelectFiltro
                id="mr-metodo" label="Método de pago"
                value={metodoVal} onChange={setMetodoVal}
                options={[
                  { id: "EFECTIVO",      nombre: "Efectivo" },
                  { id: "TRANSFERENCIA", nombre: "Transferencia" },
                  { id: "CHEQUE",        nombre: "Cheque" },
                  { id: "TARJETA",       nombre: "Tarjeta" },
                ]}
              />
            )}
            {f.includes("tipo_tx") && (
              <SelectFiltro
                id="mr-tipotx" label="Tipo de transacción"
                value={tipoTxVal} onChange={setTipoTxVal}
                options={[
                  { id: "COBRO",      nombre: "Cobro" },
                  { id: "DESEMBOLSO", nombre: "Desembolso" },
                  { id: "AJUSTE",     nombre: "Ajuste" },
                  { id: "ACCESO",     nombre: "Acceso" },
                ]}
              />
            )}
            {f.includes("accion") && (
              <SelectFiltro
                id="mr-accion" label="Acción"
                value={accionVal} onChange={setAccionVal}
                options={[
                  { id: "CREACION",     nombre: "Creación" },
                  { id: "MODIFICACION", nombre: "Modificación" },
                  { id: "ELIMINACION",  nombre: "Eliminación" },
                  { id: "CONSULTA",     nombre: "Consulta" },
                ]}
              />
            )}
          </div>
        </div>

        {/* Botón generar */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem" }}>
          <button
            className="btn btn-primary"
            onClick={buscar}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Generar reporte"}
          </button>
          {filasCSV.length > 0 && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => exportCSV(filasCSV, reporte.csvFilename)}
              >
                ⬇ CSV
              </button>
              <button className="btn btn-ghost btn-sm" onClick={imprimir}>
                🖨 Imprimir
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Resultado */}
        <div ref={resultadoRef}>
          {data && <ResultadoReporte data={data} reporte={reporte} />}
        </div>
      </div>
    </div>
  );
}

// ─── Render del resultado genérico ────────────────────────────────────────────
function ResultadoReporte({ data, reporte }: { data: any; reporte: ReporteItem }) {
  // Resumen (si existe)
  const resumen: Record<string, unknown> | null =
    data?.resumen ?? data?.totales ?? data?.summary ?? null;

  // Filas de tabla
  const filas: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data?.detalle ?? data?.data ?? data?.items ?? data?.rows ?? data?.porMes ?? [];

  if (!resumen && !filas.length) {
    return (
      <p style={{ color: "var(--text-3)", fontSize: "0.88rem", textAlign: "center", padding: "2rem 0" }}>
        Sin resultados para los filtros seleccionados.
      </p>
    );
  }

  return (
    <div>
      {/* Tarjetas resumen */}
      {resumen && (
        <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
          {Object.entries(resumen).map(([key, val]) => {
            const esNumeroGrande = typeof val === "number" && (val > 999 || key.includes("total") || key.includes("monto") || key.includes("capital") || key.includes("cobrado"));
            const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            return (
              <div key={key} className="stat-card">
                <p className="stat-label">{label}</p>
                <p className="stat-value" style={{ fontSize: "1rem" }}>
                  {esNumeroGrande ? fmt(Number(val)) : String(val)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla dinámica */}
      {filas.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {Object.keys(filas[0]).map((col) => (
                  <th key={col}>{col.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {Object.entries(fila).map(([col, val]) => {
                    const esMonto = col.includes("monto") || col.includes("capital") || col.includes("total") || col.includes("deuda") || col.includes("cobrado") || col.includes("saldo");
                    const esFecha = col.includes("fecha") || col.includes("date");
                    const esEstado = col === "estado";
                    return (
                      <td key={col}>
                        {esEstado
                          ? <span className="badge" style={{
                              background: val === "ACTIVO" || val === "PAGADO" ? "var(--success-bg)"
                                : val === "MOROSO" || val === "VENCIDA" ? "var(--danger-bg)"
                                : "var(--warning-bg)",
                              color: val === "ACTIVO" || val === "PAGADO" ? "var(--success)"
                                : val === "MOROSO" || val === "VENCIDA" ? "var(--danger)"
                                : "var(--warning)",
                            }}>{String(val ?? "—")}</span>
                          : esMonto && typeof val === "number"
                          ? <span style={{ fontWeight: 600, color: "var(--success)" }}>{fmt(val)}</span>
                          : esFecha && typeof val === "string"
                          ? <span className="text-muted">{fmtFecha(val)}</span>
                          : <span>{val == null ? "—" : String(val)}</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal MenuReportes ────────────────────────────────────────
export function MenuReportes() {
  const catalogos = useCatalogos();
  const [busqueda,      setBusqueda]      = useState("");
  const [catActiva,     setCatActiva]     = useState<string | null>(null);
  const [reporteActivo, setReporteActivo] = useState<ReporteItem | null>(null);

  // Filtrar categorías y reportes por búsqueda
  const catsFiltradas = CATEGORIAS.map((cat) => {
    const reportesFiltrados = busqueda
      ? cat.reportes.filter((r) =>
          r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          cat.label.toLowerCase().includes(busqueda.toLowerCase())
        )
      : cat.reportes;
    return { ...cat, reportes: reportesFiltrados };
  }).filter((cat) => cat.reportes.length > 0);

  const catSeleccionada = catsFiltradas.find((c) => c.id === catActiva) ?? null;

  function abrirCategoria(catId: string) {
    setCatActiva(catId === catActiva ? null : catId);
    setReporteActivo(null);
  }

  return (
    <>
      {/* Modal ventana de reporte */}
      {reporteActivo && (
        <VentanaReporte
          reporte={reporteActivo}
          catalogos={catalogos}
          onCerrar={() => setReporteActivo(null)}
        />
      )}

      {/* Topbar */}
      <div className="topbar">
        <span className="topbar-title">Reportes</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={imprimir}>
            🖨 Imprimir página
          </button>
        </div>
      </div>

      <div className="page">
        {/* Buscador */}
        <div style={{ marginBottom: "1.25rem", maxWidth: "420px" }}>
          <div style={{ position: "relative" }}>
            <input
              className="form-input"
              type="text"
              placeholder="Buscar reporte..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setCatActiva(null); }}
              style={{ paddingLeft: "2rem" }}
            />
            <span style={{
              position: "absolute", left: "0.6rem", top: "50%",
              transform: "translateY(-50%)", fontSize: "0.9rem",
              pointerEvents: "none", opacity: 0.5,
            }}>🔍</span>
          </div>
        </div>

        {/* Grid de categorías */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "10px",
          marginBottom: catActiva ? "1.25rem" : 0,
        }}>
          {catsFiltradas.map((cat) => (
            <button
              key={cat.id}
              onClick={() => abrirCategoria(cat.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${catActiva === cat.id ? cat.color : "var(--border)"}`,
                background: catActiva === cat.id ? `${cat.color}12` : "var(--surface)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{cat.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: catActiva === cat.id ? cat.color : "var(--text-1)",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {cat.label}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-3)", margin: 0 }}>
                  {cat.reportes.length} {cat.reportes.length === 1 ? "reporte" : "reportes"}
                </p>
              </div>
              <span style={{
                fontSize: "0.7rem",
                color: catActiva === cat.id ? cat.color : "var(--text-3)",
                transform: catActiva === cat.id ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}>▶</span>
            </button>
          ))}
        </div>

        {/* Panel de reportes de la categoría seleccionada */}
        {catSeleccionada && (
          <div className="card" style={{ padding: "1.25rem" }}>
            {/* Cabecera categoría */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "1rem",
              paddingBottom: "0.875rem",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: "1.3rem" }}>{catSeleccionada.icono}</span>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-1)", margin: 0 }}>
                {catSeleccionada.label}
              </h2>
              <span style={{
                marginLeft: "auto",
                fontSize: "0.75rem",
                color: "var(--text-3)",
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: "99px",
                padding: "2px 10px",
              }}>
                {catSeleccionada.reportes.length} reportes
              </span>
            </div>

            {/* Lista de botones de reportes */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "8px",
            }}>
              {catSeleccionada.reportes.map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => setReporteActivo(rep)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "11px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-2)",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = catSeleccionada.color;
                    el.style.color = catSeleccionada.color;
                    el.style.background = `${catSeleccionada.color}10`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "var(--border)";
                    el.style.color = "var(--text-2)";
                    el.style.background = "var(--surface)";
                  }}
                >
                  <span style={{ fontSize: "0.9rem", opacity: 0.6 }}>📄</span>
                  <span style={{ flex: 1 }}>{rep.nombre}</span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.4 }}>›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío búsqueda */}
        {catsFiltradas.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--text-3)",
            fontSize: "0.9rem",
          }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</p>
            No se encontraron reportes para <strong>"{busqueda}"</strong>
          </div>
        )}
      </div>
    </>
  );
}