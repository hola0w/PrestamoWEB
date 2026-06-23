import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../../db/connection";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

// ─── helper de rango de fechas ────────────────
// NOTA: siempre se debe pasar `campo` con el alias de tabla explícito
// (ej. "cq.fecha_pago"). El default "created_at" solo aplica si se
// llama sin argumento sobre una consulta de una sola tabla.
function rangoWhere(desde?: string, hasta?: string, campo = "created_at") {
  const conds: string[] = [];
  const vals: string[]  = [];
  let i = 1;
  if (desde) { conds.push(`${campo} >= $${i++}`); vals.push(desde); }
  if (hasta) { conds.push(`${campo} <= $${i++}`); vals.push(hasta); }
  return { where: conds.length ? "AND " + conds.join(" AND ") : "", vals };
}

// ─────────────────────────────────────────────
// 1. Cobros del período
// GET /api/reportes/cobros?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/cobros", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query as Record<string, string>;
    const { where, vals } = rangoWhere(desde, hasta, "cq.fecha_pago");

    const result = await pool.query(`
      SELECT
        cq.id,
        cq.fecha_pago,
        cq.fecha_vence,
        cq.monto_cuota                              AS monto_pagado,
        cq.numero_cuota,
        cq.estado                                   AS estado_cuota,
        p.capital,
        p.tipo_plazo,
        p.cuota_mensual,
        p.estado                                    AS estado_prestamo,
        CONCAT(c.nombres, ' ', c.apellidos)         AS cliente_nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1
      FROM cuotas_prestamo cq
      JOIN prestamos p ON p.id = cq.prestamo_id
      JOIN clientes  c ON c.id = p.cliente_id
      WHERE cq.estado = 'PAGADO' ${where}
      ORDER BY cq.fecha_pago DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                          AS total_cobros,
        COALESCE(SUM(cq.monto_cuota), 0)  AS total_cobrado,
        COUNT(DISTINCT cq.prestamo_id)    AS prestamos_cobrados,
        COUNT(DISTINCT p.cliente_id)      AS clientes_cobrados
      FROM cuotas_prestamo cq
      JOIN prestamos p ON p.id = cq.prestamo_id
      WHERE cq.estado = 'PAGADO' ${where}
    `, vals);

    res.json({ detalle: result.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cobros" });
  }
});

// ─────────────────────────────────────────────
// 2. Préstamos
// GET /api/reportes/prestamos?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/prestamos", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query as Record<string, string>;

    const cuotaConds: string[] = [];
    const vals: string[] = [];
    let i = 1;
    if (desde) { cuotaConds.push(`cq.fecha_vence >= $${i++}`); vals.push(desde); }
    if (hasta) { cuotaConds.push(`cq.fecha_vence <= $${i++}`); vals.push(hasta); }

    const subWhere = cuotaConds.length
      ? `AND EXISTS (
           SELECT 1 FROM cuotas_prestamo cq
           WHERE cq.prestamo_id = p.id AND ${cuotaConds.join(" AND ")}
         )`
      : "";

    const result = await pool.query(`
      SELECT
        p.id,
        p.fecha_inicio,
        p.capital,
        p.tasa_anual,
        p.plazo_meses,
        p.cuota_mensual,
        p.tipo_plazo,
        p.estado,
        CONCAT(c.nombres, ' ', c.apellidos)         AS cliente_nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1,
        (SELECT COUNT(*) FROM cuotas_prestamo cq
          WHERE cq.prestamo_id = p.id
            ${cuotaConds.length ? "AND " + cuotaConds.join(" AND ") : ""}
        )          AS cuotas_en_rango,
        COALESCE((
          SELECT SUM(cq2.monto_cuota)
          FROM cuotas_prestamo cq2
          WHERE cq2.prestamo_id = p.id AND cq2.estado = 'PAGADO'
        ), 0)      AS total_pagado,
        (p.cuota_mensual * p.plazo_meses) - COALESCE((
          SELECT SUM(cq3.monto_cuota)
          FROM cuotas_prestamo cq3
          WHERE cq3.prestamo_id = p.id AND cq3.estado = 'PAGADO'
        ), 0)      AS monto_restante
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE 1=1 ${subWhere}
      ORDER BY p.fecha_inicio DESC
    `, vals);

    const porEstado = await pool.query(`
      SELECT
        p.estado,
        COUNT(*)                             AS cantidad,
        SUM(p.capital)                       AS capital_total,
        SUM(p.cuota_mensual * p.plazo_meses) AS total_a_cobrar
      FROM prestamos p
      WHERE 1=1 ${subWhere}
      GROUP BY p.estado
      ORDER BY p.estado
    `, vals);

    res.json({ detalle: result.rows, porEstado: porEstado.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de préstamos" });
  }
});

// ─────────────────────────────────────────────
// 3. Clientes con más deuda
// GET /api/reportes/clientes-deuda
// ─────────────────────────────────────────────
router.get("/clientes-deuda", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        CONCAT(c.nombres, ' ', c.apellidos)         AS nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = FALSE LIMIT 1) AS telefono2,
        COUNT(p.id)                                 AS total_prestamos,
        SUM(p.capital)                              AS capital_total,
        SUM(
          (p.cuota_mensual * p.plazo_meses) - COALESCE((
            SELECT SUM(cp.monto_pagado)
            FROM cobros_prestamos cp
            WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
          ), 0)
        )                                           AS deuda_total,
        SUM(
          COALESCE((
            SELECT SUM(cp.monto_pagado)
            FROM cobros_prestamos cp
            WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
          ), 0)
        )                                           AS total_pagado,
        COUNT(p.id) FILTER (WHERE p.estado = 'MOROSO') AS prestamos_morosos,
        COUNT(p.id) FILTER (WHERE p.estado = 'ACTIVO')  AS prestamos_activos
      FROM clientes c
      JOIN prestamos p ON p.cliente_id = c.id
      WHERE c.estado = 'ACTIVO'
        AND p.estado NOT IN ('PAGADO')
      GROUP BY c.id, c.nombres, c.apellidos
      ORDER BY deuda_total DESC
    `);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de deuda por cliente" });
  }
});

// ─────────────────────────────────────────────
// 4. Cuotas vencidas por cliente
// GET /api/reportes/cuotas-vencidas
// ─────────────────────────────────────────────
router.get("/cuotas-vencidas", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id                                        AS cliente_id,
        CONCAT(c.nombres, ' ', c.apellidos)         AS cliente_nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = FALSE LIMIT 1) AS telefono2,
        COUNT(cp.id)                                AS cuotas_vencidas,
        SUM(cp.monto_cuota)                         AS monto_vencido,
        MIN(cp.fecha_vence)                         AS primera_vencida,
        MAX(CURRENT_DATE - cp.fecha_vence)          AS max_dias_atraso,
        p.tipo_plazo,
        p.capital,
        p.id                                        AS prestamo_id
      FROM cuotas_prestamo cp
      JOIN prestamos p ON p.id = cp.prestamo_id
      JOIN clientes  c ON c.id = p.cliente_id
      WHERE cp.estado    = 'PENDIENTE'
        AND cp.fecha_vence < CURRENT_DATE
        AND p.estado    != 'PAGADO'
      GROUP BY c.id, c.nombres, c.apellidos, p.tipo_plazo, p.capital, p.id
      ORDER BY monto_vencido DESC
    `);

    const resumen = await pool.query(`
      SELECT
        COUNT(DISTINCT p.cliente_id)  AS clientes_con_atraso,
        COUNT(cp.id)                  AS total_cuotas_vencidas,
        SUM(cp.monto_cuota)           AS monto_total_vencido
      FROM cuotas_prestamo cp
      JOIN prestamos p ON p.id = cp.prestamo_id
      WHERE cp.estado = 'PENDIENTE'
        AND cp.fecha_vence < CURRENT_DATE
        AND p.estado != 'PAGADO'
    `);

    res.json({ detalle: result.rows, resumen: resumen.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de cuotas vencidas" });
  }
});

// ─────────────────────────────────────────────
// 5. Ingresos vs capital prestado
// GET /api/reportes/ingresos?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/ingresos", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query as Record<string, string>;
    const { where, vals } = rangoWhere(desde, hasta, "cq.fecha_pago");

    const porMes = await pool.query(`
      SELECT
        DATE_TRUNC('month', cq.fecha_pago)  AS mes,
        COUNT(cq.id)                        AS cuotas_cobradas,
        SUM(cq.monto_cuota)                 AS cobrado_en_mes,
        COUNT(DISTINCT cq.prestamo_id)      AS prestamos_activos
      FROM cuotas_prestamo cq
      WHERE cq.estado = 'PAGADO' ${where}
      GROUP BY DATE_TRUNC('month', cq.fecha_pago)
      ORDER BY mes DESC
    `, vals);

    const totales = await pool.query(`
      SELECT
        SUM(p.capital)                                         AS total_capital_prestado,
        SUM(p.cuota_mensual * p.plazo_meses) - SUM(p.capital) AS ganancia_total_proyectada,
        COALESCE((
          SELECT SUM(monto_cuota) FROM cuotas_prestamo WHERE estado = 'PAGADO'
        ), 0)                                                  AS total_cobrado
      FROM prestamos p
    `);

    const cobradoPeriodo = await pool.query(`
      SELECT COALESCE(SUM(cq.monto_cuota), 0) AS cobrado_periodo
      FROM cuotas_prestamo cq
      WHERE cq.estado = 'PAGADO' ${where}
    `, vals);

    res.json({
      porMes:  porMes.rows,
      totales: { ...totales.rows[0], cobrado_periodo: cobradoPeriodo.rows[0].cobrado_periodo },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en reporte de ingresos" });
  }
});

// ─────────────────────────────────────────────
// 6. Historial de pagos por préstamo
// GET /api/reportes/historial/:prestamoId
// ─────────────────────────────────────────────
router.get("/historial/:prestamoId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const prestamoId = req.params["prestamoId"] as string;

    const prestamo = await pool.query(`
      SELECT
        p.*,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = $1
    `, [prestamoId]);

    if (!prestamo.rows[0]) {
      res.status(404).json({ error: "Préstamo no encontrado" }); return;
    }

    const cuotas = await pool.query(`
      SELECT
        cp.*,
        (CURRENT_DATE - cp.fecha_vence) AS dias_atraso
      FROM cuotas_prestamo cp
      WHERE cp.prestamo_id = $1
      ORDER BY cp.numero_cuota ASC
    `, [prestamoId]);

    // FIX: cobros_prestamos no tiene columna `fecha_crea`, es `created_at`
    const cobros = await pool.query(`
      SELECT * FROM cobros_prestamos
      WHERE prestamo_id = $1
      ORDER BY created_at DESC
    `, [prestamoId]);

    const resumen = await pool.query(`
      SELECT
        COUNT(cp.id)                                               AS total_cuotas,
        COUNT(cp.id) FILTER (WHERE cp.estado = 'PAGADO')          AS cuotas_pagadas,
        COUNT(cp.id) FILTER (WHERE cp.estado = 'PENDIENTE'
                               AND cp.fecha_vence >= CURRENT_DATE) AS cuotas_pendientes,
        COUNT(cp.id) FILTER (WHERE cp.estado = 'PENDIENTE'
                               AND cp.fecha_vence < CURRENT_DATE)  AS cuotas_vencidas,
        COALESCE(SUM(cp.monto_cuota) FILTER (WHERE cp.estado = 'PAGADO'),    0) AS monto_pagado,
        COALESCE(SUM(cp.monto_cuota) FILTER (WHERE cp.estado = 'PENDIENTE'), 0) AS monto_pendiente
      FROM cuotas_prestamo cp
      WHERE cp.prestamo_id = $1
    `, [prestamoId]);

    res.json({
      prestamo: prestamo.rows[0],
      cuotas:   cuotas.rows,
      cobros:   cobros.rows,
      resumen:  resumen.rows[0],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error en historial de préstamo" });
  }
});

// ─────────────────────────────────────────────
// 7. Listado de préstamos (selector de historial)
// GET /api/reportes/prestamos-lista
// ─────────────────────────────────────────────
router.get("/prestamos-lista", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
        p.capital,
        p.estado,
        p.fecha_inicio,
        p.tipo_plazo
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ORDER BY p.fecha_inicio DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener lista de préstamos" });
  }
});

export default router;