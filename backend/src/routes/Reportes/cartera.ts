import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../../db/connection";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────
// totalCuotas: factor según tipo_plazo, igual que prestamoService.cuotasPorMes
const FACTOR_SQL = `
  CASE p.tipo_plazo
    WHEN 'QUINCENAL' THEN 2
    WHEN 'SEMANAL'   THEN 4
    WHEN 'DIARIO'    THEN 30
    ELSE 1
  END
`;

// total a pagar del préstamo = cuota_mensual * (plazo_meses * factor)
const TOTAL_PRESTAMO_SQL = `(p.cuota_mensual * p.plazo_meses * ${FACTOR_SQL})`;

// total pagado = suma de cobros aplicados
const TOTAL_PAGADO_SQL = `
  COALESCE((
    SELECT SUM(cp.monto_pagado)
    FROM cobros_prestamos cp
    WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
  ), 0)
`;

// saldo pendiente real = total a pagar - total pagado
const SALDO_PENDIENTE_SQL = `(${TOTAL_PRESTAMO_SQL} - ${TOTAL_PAGADO_SQL})`;

function getEmpresaId(req: Request): string | null {
  return (req as any).user?.empresaId ?? null;
}

// Valida formato UUID v4 genérico. Se usa para descartar valores como
// "SUR", "CENTRAL", etc. que el frontend puede enviar como fallback
// cuando el catálogo real (sucursales/zonas) aún está vacío. Sin esto,
// Postgres lanza error 22P02 (invalid input syntax for type uuid) y
// el endpoint responde 500 en vez de simplemente ignorar el filtro.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function esUuidValido(valor?: string): boolean {
  return !!valor && UUID_REGEX.test(valor);
}

interface FiltrosComunes {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  cobradorId?: string;
  tipo?: string;
  zonaId?: string;
}

// Construye condiciones WHERE comunes a los reportes de cartera.
// Todas referencian alias `p` (prestamos) y `c` (clientes).
function condicionesCartera(req: Request, opciones: { conRangoFecha?: boolean } = {}) {
  const q = req.query as Record<string, string>;
  const empresaId = getEmpresaId(req);

  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (empresaId) { conds.push(`p.empresa_id = $${i++}`); vals.push(empresaId); }

  if (opciones.conRangoFecha) {
    if (q.desde) { conds.push(`p.fecha_inicio >= $${i++}`); vals.push(q.desde); }
    if (q.hasta) { conds.push(`p.fecha_inicio <= $${i++}`); vals.push(q.hasta); }
  }
  if (esUuidValido(q.sucursalId)) { conds.push(`p.sucursal_id = $${i++}`); vals.push(q.sucursalId); }
  if (esUuidValido(q.cobradorId)) { conds.push(`p.cobrador_id = $${i++}`); vals.push(q.cobradorId); }
  if (esUuidValido(q.zonaId))     { conds.push(`c.zona_id = $${i++}`);     vals.push(q.zonaId); }
  // "tipo" en estos reportes se refiere a tipo_plazo del préstamo
  if (q.tipo)       { conds.push(`p.tipo_plazo = $${i++}`);  vals.push(q.tipo); }

  return { where: conds.length ? "WHERE " + conds.join(" AND ") : "", vals };
}

const SELECT_BASE = `
  p.id,
  CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
  c.documento_identidad,
  p.capital,
  p.interes_total,
  p.tasa_anual,
  p.tipo_plazo,
  p.plazo_meses,
  p.cuota_mensual,
  p.estado,
  p.fecha_inicio,
  ${TOTAL_PRESTAMO_SQL}    AS total_prestamo,
  ${TOTAL_PAGADO_SQL}      AS total_pagado,
  ${SALDO_PENDIENTE_SQL}   AS saldo_pendiente
`;

// ─────────────────────────────────────────────
// 1. Reporte general de cartera
// GET /api/reportes/cartera/general?desde=&hasta=&sucursalId=&tipo=
// ─────────────────────────────────────────────
router.get("/general", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });

    const detalle = await pool.query(`
      SELECT ${SELECT_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${where}
      ORDER BY p.fecha_inicio DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                          AS total_prestamos,
        COALESCE(SUM(p.capital), 0)       AS capital_total,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)  AS total_a_cobrar,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)    AS total_cobrado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_total_pendiente
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${where}
    `, vals);

    res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte general de cartera" });
  }
});

// ─────────────────────────────────────────────
// 2. Cartera activa
// GET /api/reportes/cartera/activa?desde=&hasta=&sucursalId=
// ─────────────────────────────────────────────
router.get("/activa", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });
    const whereFinal = where
      ? `${where} AND p.estado = 'ACTIVO'`
      : `WHERE p.estado = 'ACTIVO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
      ORDER BY p.fecha_inicio DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                                 AS prestamos_activos,
        COALESCE(SUM(p.capital), 0)              AS capital_activo,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_pendiente_activo
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
    `, vals);

    res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cartera activa" });
  }
});

// ─────────────────────────────────────────────
// 3. Cartera vencida
// GET /api/reportes/cartera/vencida?desde=&hasta=&sucursalId=&rangoMora=
// Préstamo "vencido" = tiene al menos una cuota PENDIENTE con fecha_vence < hoy
// ─────────────────────────────────────────────
router.get("/vencida", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });
    const q = req.query as Record<string, string>;

    let rangoCond = "";
    if (q.rangoMora) {
      const rangos: Record<string, string> = {
        "1-30":  "BETWEEN 1 AND 30",
        "31-60": "BETWEEN 31 AND 60",
        "61-90": "BETWEEN 61 AND 90",
        "90+":   "> 90",
      };
      const cond = rangos[q.rangoMora];
      if (cond) rangoCond = `AND (CURRENT_DATE - cq.fecha_vence) ${cond}`;
    }

    const whereFinal = where ? `${where} AND` : "WHERE";

    const detalle = await pool.query(`
      SELECT
        ${SELECT_BASE},
        MIN(cq.fecha_vence)                AS primera_cuota_vencida,
        MAX(CURRENT_DATE - cq.fecha_vence) AS max_dias_atraso,
        COUNT(cq.id)                       AS cuotas_vencidas,
        SUM(cq.monto_cuota)                AS monto_vencido
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN cuotas_prestamo cq ON cq.prestamo_id = p.id
      ${whereFinal} cq.estado = 'PENDIENTE'
        AND cq.fecha_vence < CURRENT_DATE
        ${rangoCond}
      GROUP BY p.id, c.nombres, c.apellidos, c.documento_identidad
      ORDER BY max_dias_atraso DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(DISTINCT p.id)        AS prestamos_vencidos,
        COUNT(cq.id)                AS total_cuotas_vencidas,
        COALESCE(SUM(cq.monto_cuota), 0) AS monto_total_vencido
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN cuotas_prestamo cq ON cq.prestamo_id = p.id
      ${whereFinal} cq.estado = 'PENDIENTE'
        AND cq.fecha_vence < CURRENT_DATE
        ${rangoCond}
    `, vals);

    res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cartera vencida" });
  }
});

// ─────────────────────────────────────────────
// 4. Cartera castigada
// GET /api/reportes/cartera/castigada?desde=&hasta=&sucursalId=
// NOTA: tu schema no tiene un estado "CASTIGADO" en estado_prestamo
// (valores: PENDIENTE, APROBADO, ACTIVO, PAGADO, MOROSO, CANCELADO).
// Se usa CANCELADO como aproximación de "castigada" (préstamo dado de
// baja). Si tu negocio distingue cancelado de castigado, se necesita
// agregar ese valor al enum estado_prestamo.
// ─────────────────────────────────────────────
router.get("/castigada", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });
    const whereFinal = where
      ? `${where} AND p.estado = 'CANCELADO'`
      : `WHERE p.estado = 'CANCELADO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
      ORDER BY p.fecha_inicio DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                                 AS prestamos_castigados,
        COALESCE(SUM(p.capital), 0)              AS capital_castigado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_no_recuperado
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
    `, vals);

    res.json({
      detalle: detalle.rows,
      resumen: resumen.rows[0],
      nota: "Se usa estado CANCELADO como equivalente de cartera castigada.",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cartera castigada" });
  }
});

// ─────────────────────────────────────────────
// 5. Cartera por tipo de préstamo (tipo_plazo)
// GET /api/reportes/cartera/por-tipo?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/por-tipo", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });

    const result = await pool.query(`
      SELECT
        p.tipo_plazo,
        COUNT(*)                                 AS cantidad,
        COALESCE(SUM(p.capital), 0)              AS capital_total,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)  AS total_a_cobrar,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)    AS total_cobrado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_pendiente
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${where}
      GROUP BY p.tipo_plazo
      ORDER BY p.tipo_plazo
    `, vals);

    res.json({ porTipo: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cartera por tipo" });
  }
});

// ─────────────────────────────────────────────
// 6. Cartera por sucursal
// GET /api/reportes/cartera/por-sucursal?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/por-sucursal", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });

    const result = await pool.query(`
      SELECT
        s.id                                      AS sucursal_id,
        COALESCE(s.nombre, 'Sin sucursal')         AS sucursal_nombre,
        COUNT(p.id)                                AS cantidad,
        COALESCE(SUM(p.capital), 0)                AS capital_total,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)    AS total_a_cobrar,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)      AS total_cobrado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0)   AS saldo_pendiente
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN sucursales s ON s.id = p.sucursal_id
      ${where}
      GROUP BY s.id, s.nombre
      ORDER BY total_a_cobrar DESC
    `, vals);

    res.json({ porSucursal: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cartera por sucursal" });
  }
});

// ─────────────────────────────────────────────
// 7. Cartera por zona geográfica
// GET /api/reportes/cartera/por-zona?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/por-zona", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesCartera(req, { conRangoFecha: true });

    const result = await pool.query(`
      SELECT
        z.id                                      AS zona_id,
        COALESCE(z.nombre, 'Sin zona')             AS zona_nombre,
        COUNT(p.id)                                AS cantidad,
        COALESCE(SUM(p.capital), 0)                AS capital_total,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)    AS total_a_cobrar,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)      AS total_cobrado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0)   AS saldo_pendiente
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN zonas z ON z.id = c.zona_id
      ${where}
      GROUP BY z.id, z.nombre
      ORDER BY total_a_cobrar DESC
    `, vals);

    res.json({ porZona: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cartera por zona" });
  }
});

export default router;

// ════════════════════════════════════════════════════════════
// NOTA SOBRE EL FILTRO "oficial" ELIMINADO:
// El frontend (MenuReportes.tsx) original incluía "oficial" como
// filtro en varios de estos reportes (cartera-general, cartera-activa,
// cartera-oficial). Se confirmó que el negocio no maneja "oficial de
// crédito" como rol separado, así que:
//   - Se eliminó el filtro "oficial" de estos endpoints.
//   - El reporte "Cartera por oficial de crédito" (cartera-por-oficial)
//     NO se implementa en esta tanda. Si más adelante se requiere un
//     reporte equivalente por "quién registró el préstamo", se puede
//     construir agrupando por p.created_by / usuario_registra_id.
// ════════════════════════════════════════════════════════════