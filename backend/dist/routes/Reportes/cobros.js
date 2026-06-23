"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../../db/connection");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
function getEmpresaId(req) {
    return req.user?.empresaId ?? null;
}
// Condiciones comunes — alias cp (cobros_prestamos), p (prestamos), c (clientes)
function condicionesBase(req) {
    const q = req.query;
    const empresaId = getEmpresaId(req);
    const conds = [];
    const vals = [];
    let i = 1;
    if (empresaId) {
        conds.push(`p.empresa_id = $${i++}`);
        vals.push(empresaId);
    }
    if (q.desde) {
        conds.push(`cp.created_at >= $${i++}`);
        vals.push(q.desde);
    }
    if (q.hasta) {
        conds.push(`cp.created_at <= $${i++}`);
        vals.push(q.hasta);
    }
    if (q.clienteId) {
        conds.push(`p.cliente_id = $${i++}`);
        vals.push(q.clienteId);
    }
    if (q.prestamoId) {
        conds.push(`cp.prestamo_id = $${i++}`);
        vals.push(q.prestamoId);
    }
    if (q.metodoPago) {
        conds.push(`pg.metodo_pago = $${i++}`);
        vals.push(q.metodoPago);
    }
    return { where: conds.length ? "WHERE " + conds.join(" AND ") : "", vals };
}
const SELECT_BASE = `
  cp.id,
  cp.monto_pagado,
  cp.estado_cobro,
  cp.created_at,
  p.id                                  AS prestamo_id,
  p.capital,
  p.cuota_mensual,
  CONCAT(c.nombres, ' ', c.apellidos)   AS cliente_nombre,
  c.documento_identidad,
  pg.metodo_pago,
  pg.referencia_pago
`;
const FROM_BASE = `
  FROM cobros_prestamos cp
  JOIN prestamos p     ON p.id  = cp.prestamo_id
  JOIN clientes  c     ON c.id  = p.cliente_id
  LEFT JOIN pagos pg   ON pg.id = cp.pago_id
`;
// ─────────────────────────────────────────────
// 1. Cobros recibidos
// GET /api/reportes/cobros/recibidos?desde=&hasta=&clienteId=&metodoPago=
// ─────────────────────────────────────────────
router.get("/recibidos", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req);
        const whereFinal = where ? `${where} AND cp.estado_cobro = 'PAGADO'` : `WHERE cp.estado_cobro = 'PAGADO'`;
        const detalle = await connection_1.pool.query(`
      SELECT ${SELECT_BASE}
      ${FROM_BASE}
      ${whereFinal}
      ORDER BY cp.created_at DESC
    `, vals);
        const resumen = await connection_1.pool.query(`
      SELECT
        COUNT(*)                          AS total_cobros,
        COALESCE(SUM(cp.monto_pagado), 0) AS total_cobrado,
        COUNT(DISTINCT cp.prestamo_id)    AS prestamos_cobrados,
        COUNT(DISTINCT p.cliente_id)      AS clientes_cobrados
      ${FROM_BASE}
      ${whereFinal}
    `, vals);
        res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de cobros recibidos" });
    }
});
// ─────────────────────────────────────────────
// 2. Pagos parciales
// GET /api/reportes/cobros/parciales?desde=&hasta=&clienteId=
// ─────────────────────────────────────────────
router.get("/parciales", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req);
        const whereFinal = where ? `${where} AND cp.estado_cobro = 'PARCIAL'` : `WHERE cp.estado_cobro = 'PARCIAL'`;
        const detalle = await connection_1.pool.query(`
      SELECT ${SELECT_BASE}
      ${FROM_BASE}
      ${whereFinal}
      ORDER BY cp.created_at DESC
    `, vals);
        const resumen = await connection_1.pool.query(`
      SELECT
        COUNT(*)                          AS total_pagos_parciales,
        COALESCE(SUM(cp.monto_pagado), 0) AS monto_total_parcial
      ${FROM_BASE}
      ${whereFinal}
    `, vals);
        res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de pagos parciales" });
    }
});
// ─────────────────────────────────────────────
// 3. Pagos completos (alias semántico de "cobros recibidos" con estado PAGADO)
// GET /api/reportes/cobros/completos?desde=&hasta=&clienteId=
// ─────────────────────────────────────────────
router.get("/completos", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req);
        const whereFinal = where ? `${where} AND cp.estado_cobro = 'PAGADO'` : `WHERE cp.estado_cobro = 'PAGADO'`;
        const detalle = await connection_1.pool.query(`
      SELECT ${SELECT_BASE}
      ${FROM_BASE}
      ${whereFinal}
      ORDER BY cp.created_at DESC
    `, vals);
        const resumen = await connection_1.pool.query(`
      SELECT
        COUNT(*)                          AS total_pagos_completos,
        COALESCE(SUM(cp.monto_pagado), 0) AS monto_total
      ${FROM_BASE}
      ${whereFinal}
    `, vals);
        res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de pagos completos" });
    }
});
// ─────────────────────────────────────────────
// 4. Pagos anticipados
// GET /api/reportes/cobros/anticipados?desde=&hasta=&clienteId=
// "Anticipado" = el cobro se aplicó a una cuota (cp.cuota_id) cuya
// fecha_vence aún no había llegado al momento del pago.
// NOTA: cobros_prestamos no tiene columna cuota_id directa en el
// schema visto — se infiere vía pagos.cuota_id (pagos sí la tiene).
// ─────────────────────────────────────────────
router.get("/anticipados", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req);
        const whereFinal = where
            ? `${where} AND cp.estado_cobro = 'PAGADO' AND cq.fecha_vence > pg.fecha_pago::date`
            : `WHERE cp.estado_cobro = 'PAGADO' AND cq.fecha_vence > pg.fecha_pago::date`;
        const detalle = await connection_1.pool.query(`
      SELECT
        ${SELECT_BASE},
        cq.fecha_vence,
        pg.fecha_pago,
        (cq.fecha_vence - pg.fecha_pago::date) AS dias_anticipacion
      ${FROM_BASE}
      JOIN cuotas_prestamo cq ON cq.id = pg.cuota_id
      ${whereFinal}
      ORDER BY pg.fecha_pago DESC
    `, vals);
        const resumen = await connection_1.pool.query(`
      SELECT
        COUNT(*)                          AS total_pagos_anticipados,
        COALESCE(SUM(cp.monto_pagado), 0) AS monto_total
      ${FROM_BASE}
      JOIN cuotas_prestamo cq ON cq.id = pg.cuota_id
      ${whereFinal}
    `, vals);
        res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de pagos anticipados" });
    }
});
// ─────────────────────────────────────────────
// 5. Pagos por método de pago
// GET /api/reportes/cobros/por-metodo?desde=&hasta=
// ─────────────────────────────────────────────
router.get("/por-metodo", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req);
        const whereFinal = where ? `${where} AND cp.estado_cobro = 'PAGADO'` : `WHERE cp.estado_cobro = 'PAGADO'`;
        const result = await connection_1.pool.query(`
      SELECT
        COALESCE(pg.metodo_pago, 'Sin especificar') AS metodo_pago,
        COUNT(*)                                    AS cantidad,
        COALESCE(SUM(cp.monto_pagado), 0)           AS monto_total
      ${FROM_BASE}
      ${whereFinal}
      GROUP BY pg.metodo_pago
      ORDER BY monto_total DESC
    `, vals);
        res.json({ porMetodo: result.rows });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de pagos por método" });
    }
});
// ─────────────────────────────────────────────
// 6. Historial de pagos (por préstamo)
// GET /api/reportes/cobros/historial?prestamoId=
// ─────────────────────────────────────────────
router.get("/historial", auth_1.authMiddleware, async (req, res) => {
    try {
        const prestamoId = req.query.prestamoId;
        if (!prestamoId) {
            res.status(400).json({ error: "prestamoId es requerido" });
            return;
        }
        const result = await connection_1.pool.query(`
      SELECT ${SELECT_BASE}
      ${FROM_BASE}
      WHERE cp.prestamo_id = $1
      ORDER BY cp.created_at DESC
    `, [prestamoId]);
        res.json({ detalle: result.rows });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en historial de pagos" });
    }
});
exports.default = router;
// ════════════════════════════════════════════════════════════
// NOTA SOBRE "PAGOS ANTICIPADOS":
// Se infiere comparando cuotas_prestamo.fecha_vence vs pagos.fecha_pago,
// asumiendo que pagos.cuota_id está poblado correctamente en el flujo
// real de cobro. Si en la práctica un cobro puede aplicar a múltiples
// cuotas o pagos.cuota_id queda null en algunos casos, este reporte
// subestimará el conteo. Verificar con datos reales tras desplegar.
// ════════════════════════════════════════════════════════════
//# sourceMappingURL=cobros.js.map