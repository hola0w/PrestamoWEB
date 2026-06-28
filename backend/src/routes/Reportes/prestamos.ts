import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../../db/connection";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────
//
// FACTOR por tipo de plazo: convierte plazo_meses → número de cuotas reales.
//   MENSUAL   × 1  = plazo_meses cuotas
//   QUINCENAL × 2  = plazo_meses * 2 cuotas
//   SEMANAL   × 4  = plazo_meses * 4 cuotas
//   DIARIO    × 30 = plazo_meses * 30 cuotas
//
const FACTOR_SQL = `
  CASE p.tipo_plazo
    WHEN 'QUINCENAL' THEN 2
    WHEN 'SEMANAL'   THEN 4
    WHEN 'DIARIO'    THEN 30
    ELSE 1
  END
`;

// Total nominal del préstamo (cuota × número de cuotas)
const TOTAL_PRESTAMO_SQL = `(p.cuota_mensual * p.plazo_meses * ${FACTOR_SQL})`;

// FIX: se incluyen cobros PARCIAL y ATRASADO además de PAGADO,
// porque todos representan dinero efectivamente recibido.
const TOTAL_PAGADO_SQL = `
  COALESCE((
    SELECT SUM(cp.monto_pagado)
    FROM cobros_prestamos cp
    WHERE cp.prestamo_id = p.id
      AND cp.estado_cobro IN ('PAGADO', 'PARCIAL', 'ATRASADO')
  ), 0)
`;

const SALDO_PENDIENTE_SQL = `(${TOTAL_PRESTAMO_SQL} - ${TOTAL_PAGADO_SQL})`;

// ─── Columnas base del SELECT de detalle ───────────────────────────────────
// Se listan columnas explícitas (no p.*) para evitar exponer datos sensibles.
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
  p.fecha_aprobacion,
  p.fecha_fin,
  ${TOTAL_PRESTAMO_SQL}  AS total_prestamo,
  ${TOTAL_PAGADO_SQL}    AS total_pagado,
  ${SALDO_PENDIENTE_SQL} AS saldo_pendiente
`;

// ─── Utilidades ────────────────────────────────────────────────────────────
function getEmpresaId(req: Request): string | null {
  return (req as any).user?.empresaId ?? null;
}

/**
 * Construye cláusula WHERE + valores parametrizados a partir de los
 * query params comunes (empresaId, fechas, clienteId, sucursalId, tipo).
 * Alias esperados: p → prestamos, c → clientes.
 */
function condicionesBase(
  req: Request,
  opciones: { conRangoFecha?: boolean } = {}
) {
  const q = req.query as Record<string, string>;
  const empresaId = getEmpresaId(req);

  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (empresaId) {
    conds.push(`p.empresa_id = $${i++}`);
    vals.push(empresaId);
  }

  if (opciones.conRangoFecha) {
    if (q.desde) { conds.push(`p.fecha_inicio >= $${i++}`); vals.push(q.desde); }
    if (q.hasta) { conds.push(`p.fecha_inicio <= $${i++}`); vals.push(q.hasta); }
  }

  if (q.clienteId)  { conds.push(`p.cliente_id  = $${i++}`); vals.push(q.clienteId); }
  if (q.sucursalId) { conds.push(`p.sucursal_id = $${i++}`); vals.push(q.sucursalId); }
  if (q.tipo)       { conds.push(`p.tipo_plazo  = $${i++}`); vals.push(q.tipo); }

  return {
    where: conds.length ? "WHERE " + conds.join(" AND ") : "",
    vals,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Préstamos activos
// GET /api/reportes/prestamos/activos?desde=&hasta=&clienteId=&sucursalId=&tipo=
// ═══════════════════════════════════════════════════════════════════════════
router.get("/activos", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesBase(req, { conRangoFecha: true });

    // Agrega el filtro de estado al WHERE ya construido
    const whereFinal = where
      ? `${where} AND p.estado = 'ACTIVO'`
      : `WHERE p.estado = 'ACTIVO'`;

    const detalle = await pool.query(
      `SELECT ${SELECT_BASE}
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
       ${whereFinal}
       ORDER BY p.fecha_inicio DESC`,
      vals
    );

    const resumen = await pool.query(
      `SELECT
         COUNT(*)                                  AS total_activos,
         COALESCE(SUM(p.capital), 0)               AS capital_total,
         COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0)  AS saldo_pendiente_total
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
       ${whereFinal}`,
      vals
    );

    res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de préstamos activos" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Préstamos finalizados (estado = PAGADO)
// GET /api/reportes/prestamos/finalizados?desde=&hasta=&clienteId=&sucursalId=
//
// FIX: TOTAL_PAGADO_SQL ahora incluye cobros PARCIAL y ATRASADO para que
//      total_cobrado refleje el dinero real recibido, no solo los marcados PAGADO.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/finalizados", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { where, vals } = condicionesBase(req, { conRangoFecha: true });

    const whereFinal = where
      ? `${where} AND p.estado = 'PAGADO'`
      : `WHERE p.estado = 'PAGADO'`;

    const detalle = await pool.query(
      `SELECT ${SELECT_BASE}
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
       ${whereFinal}
       ORDER BY p.fecha_fin DESC NULLS LAST, p.fecha_inicio DESC`,
      vals
    );

    const resumen = await pool.query(
      `SELECT
         COUNT(*)                               AS total_finalizados,
         COALESCE(SUM(p.capital), 0)            AS capital_total,
         COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)  AS total_cobrado
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
       ${whereFinal}`,
      vals
    );

    res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de préstamos finalizados" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Préstamos por período (agrupado por mes de fecha_inicio)
// GET /api/reportes/prestamos/por-periodo?desde=&hasta=&tipo=&sucursalId=
//
// FIX: se eliminó el JOIN a clientes porque ninguna columna de esa tabla
//      se usaba en el SELECT ni en el WHERE → mejora de rendimiento.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/por-periodo", authMiddleware, async (req: Request, res: Response) => {
  try {
    // condicionesBase usa alias 'c' solo si se necesita; aquí no hay JOIN a clientes,
    // así que excluimos cualquier condición que referencie 'c'.
    const q = req.query as Record<string, string>;
    const empresaId = getEmpresaId(req);

    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (empresaId) { conds.push(`p.empresa_id  = $${i++}`); vals.push(empresaId); }
    if (q.desde)   { conds.push(`p.fecha_inicio >= $${i++}`); vals.push(q.desde); }
    if (q.hasta)   { conds.push(`p.fecha_inicio <= $${i++}`); vals.push(q.hasta); }
    if (q.sucursalId) { conds.push(`p.sucursal_id = $${i++}`); vals.push(q.sucursalId); }
    if (q.tipo)    { conds.push(`p.tipo_plazo   = $${i++}`); vals.push(q.tipo); }

    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

    const result = await pool.query(
      `SELECT
         DATE_TRUNC('month', p.fecha_inicio)     AS mes,
         COUNT(*)                                AS cantidad,
         COALESCE(SUM(p.capital), 0)             AS capital_otorgado,
         COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0) AS total_a_cobrar
       FROM prestamos p
       ${where}
       GROUP BY DATE_TRUNC('month', p.fecha_inicio)
       ORDER BY mes DESC`,
      vals
    );

    res.json({ porMes: result.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de préstamos por período" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Historial completo de un préstamo
// GET /api/reportes/prestamos/historial?prestamoId=<uuid>
//
// FIXES aplicados:
//   1. p.* reemplazado por columnas explícitas (sin datos sensibles innecesarios).
//   2. El alias de días de atraso calculado se renombra a 'dias_vencidos' para
//      evitar ocultar la columna almacenada 'cp.dias_atraso'.
//   3. dias_vencidos se fuerza a 0 cuando la cuota aún no está vencida
//      (GREATEST evita valores negativos).
// ═══════════════════════════════════════════════════════════════════════════
router.get("/historial", authMiddleware, async (req: Request, res: Response) => {
  try {
    const prestamoId = (req.query as Record<string, string>).prestamoId;
    if (!prestamoId) {
      res.status(400).json({ error: "prestamoId es requerido" });
      return;
    }

    // ── Préstamo con datos del cliente ──────────────────────────────────
    const prestamo = await pool.query(
      `SELECT
         p.id,
         p.capital,
         p.interes_total,
         p.balance_pendiente,
         p.tasa_anual,
         p.mora_porcentaje,
         p.plazo_meses,
         p.cuota_mensual,
         p.tipo_plazo,
         p.garantia,
         p.observacion,
         p.estado,
         p.fecha_solicitud,
         p.fecha_aprobacion,
         p.fecha_inicio,
         p.fecha_fin,
         p.created_at,
         p.updated_at,
         CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
         c.documento_identidad,
         c.email                             AS cliente_email,
         (
           SELECT t.telefono
           FROM telefonos_clientes t
           WHERE t.cliente_id = c.id
             AND t.principal = TRUE
           LIMIT 1
         ) AS telefono_principal
       FROM prestamos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id = $1`,
      [prestamoId]
    );

    if (!prestamo.rows[0]) {
      res.status(404).json({ error: "Préstamo no encontrado" });
      return;
    }

    // ── Cuotas ──────────────────────────────────────────────────────────
    // FIX: alias renombrado a 'dias_vencidos' para no ocultar la columna
    //      almacenada 'cp.dias_atraso'. GREATEST(..., 0) evita negativos
    //      en cuotas cuya fecha de vencimiento es futura.
    const cuotas = await pool.query(
      `SELECT
         cp.id,
         cp.numero_cuota,
         cp.fecha_vence,
         cp.fecha_pago,
         cp.monto_cuota,
         cp.capital_pagado,
         cp.interes_pagado,
         cp.mora_pagada,
         cp.balance_restante,
         cp.dias_atraso,
         cp.estado,
         GREATEST(CURRENT_DATE - cp.fecha_vence, 0) AS dias_vencidos
       FROM cuotas_prestamo cp
       WHERE cp.prestamo_id = $1
       ORDER BY cp.numero_cuota ASC`,
      [prestamoId]
    );

    // ── Cobros ──────────────────────────────────────────────────────────
    const cobros = await pool.query(
      `SELECT
         cb.id,
         cb.monto_pagado,
         cb.estado_cobro,
         cb.created_at,
         cb.updated_at,
         cb.empresa_id
       FROM cobros_prestamos cb
       WHERE cb.prestamo_id = $1
       ORDER BY cb.created_at DESC`,
      [prestamoId]
    );

    res.json({
      prestamo: prestamo.rows[0],
      cuotas:   cuotas.rows,
      cobros:   cobros.rows,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en historial de préstamo" });
  }
});

export default router;