"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../../db/connection");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// ─── Helpers (mismo patrón que reportesCarteraRouter.ts) ───────
const FACTOR_SQL = `
  CASE p.tipo_plazo
    WHEN 'QUINCENAL' THEN 2
    WHEN 'SEMANAL'   THEN 4
    WHEN 'DIARIO'    THEN 30
    ELSE 1
  END
`;
const TOTAL_PRESTAMO_SQL = `(p.cuota_mensual * p.plazo_meses * ${FACTOR_SQL})`;
const TOTAL_PAGADO_SQL = `
  COALESCE((
    SELECT SUM(cp.monto_pagado)
    FROM cobros_prestamos cp
    WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
  ), 0)
`;
const SALDO_PENDIENTE_SQL = `(${TOTAL_PRESTAMO_SQL} - ${TOTAL_PAGADO_SQL})`;
function getEmpresaId(req) {
    return req.user?.empresaId ?? null;
}
// Condiciones comunes — alias p (prestamos), c (clientes)
function condicionesBase(req, opciones = {}) {
    const q = req.query;
    const empresaId = getEmpresaId(req);
    const conds = [];
    const vals = [];
    let i = 1;
    if (empresaId) {
        conds.push(`p.empresa_id = $${i++}`);
        vals.push(empresaId);
    }
    if (opciones.conRangoFecha) {
        if (q.desde) {
            conds.push(`p.fecha_inicio >= $${i++}`);
            vals.push(q.desde);
        }
        if (q.hasta) {
            conds.push(`p.fecha_inicio <= $${i++}`);
            vals.push(q.hasta);
        }
    }
    if (q.clienteId) {
        conds.push(`p.cliente_id = $${i++}`);
        vals.push(q.clienteId);
    }
    if (q.sucursalId) {
        conds.push(`p.sucursal_id = $${i++}`);
        vals.push(q.sucursalId);
    }
    if (q.tipo) {
        conds.push(`p.tipo_plazo = $${i++}`);
        vals.push(q.tipo);
    }
    return { where: conds.length ? "WHERE " + conds.join(" AND ") : "", vals, conds, vals_i: i };
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
  p.fecha_aprobacion,
  p.fecha_fin,
  ${TOTAL_PRESTAMO_SQL}    AS total_prestamo,
  ${TOTAL_PAGADO_SQL}      AS total_pagado,
  ${SALDO_PENDIENTE_SQL}   AS saldo_pendiente
`;
// ─────────────────────────────────────────────
// 1. Préstamos activos
// GET /api/reportes/prestamos/activos?desde=&hasta=&clienteId=&sucursalId=&tipo=
// ─────────────────────────────────────────────
router.get("/activos", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req, { conRangoFecha: true });
        const whereFinal = where ? `${where} AND p.estado = 'ACTIVO'` : `WHERE p.estado = 'ACTIVO'`;
        const detalle = await connection_1.pool.query(`
      SELECT ${SELECT_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
      ORDER BY p.fecha_inicio DESC
    `, vals);
        const resumen = await connection_1.pool.query(`
      SELECT
        COUNT(*)                                 AS total_activos,
        COALESCE(SUM(p.capital), 0)              AS capital_total,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_pendiente_total
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
    `, vals);
        res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de préstamos activos" });
    }
});
// ─────────────────────────────────────────────
// 2. Préstamos finalizados (estado = PAGADO)
// GET /api/reportes/prestamos/finalizados?desde=&hasta=&clienteId=
// ─────────────────────────────────────────────
router.get("/finalizados", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req, { conRangoFecha: true });
        const whereFinal = where ? `${where} AND p.estado = 'PAGADO'` : `WHERE p.estado = 'PAGADO'`;
        const detalle = await connection_1.pool.query(`
      SELECT ${SELECT_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
      ORDER BY p.fecha_fin DESC NULLS LAST, p.fecha_inicio DESC
    `, vals);
        const resumen = await connection_1.pool.query(`
      SELECT
        COUNT(*)                            AS total_finalizados,
        COALESCE(SUM(p.capital), 0)         AS capital_total,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0) AS total_cobrado
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
    `, vals);
        res.json({ detalle: detalle.rows, resumen: resumen.rows[0] });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de préstamos finalizados" });
    }
});
// ─────────────────────────────────────────────
// 3. Préstamos por período
// GET /api/reportes/prestamos/por-periodo?desde=&hasta=&tipo=&sucursalId=
// Agrupa por mes de fecha_inicio dentro del rango.
// ─────────────────────────────────────────────
router.get("/por-periodo", auth_1.authMiddleware, async (req, res) => {
    try {
        const { where, vals } = condicionesBase(req, { conRangoFecha: true });
        const result = await connection_1.pool.query(`
      SELECT
        DATE_TRUNC('month', p.fecha_inicio)      AS mes,
        COUNT(*)                                 AS cantidad,
        COALESCE(SUM(p.capital), 0)              AS capital_otorgado,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)  AS total_a_cobrar
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${where}
      GROUP BY DATE_TRUNC('month', p.fecha_inicio)
      ORDER BY mes DESC
    `, vals);
        res.json({ porMes: result.rows });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en reporte de préstamos por período" });
    }
});
// ─────────────────────────────────────────────
// 4. Historial de préstamos (alias de /reportes/historial/:id existente,
// pero accesible bajo el namespace de la categoría "Préstamos" del menú).
// Reutiliza exactamente la misma lógica que reportesRouter.ts -> /historial/:prestamoId
// GET /api/reportes/prestamos/historial?prestamoId=
// ─────────────────────────────────────────────
router.get("/historial", auth_1.authMiddleware, async (req, res) => {
    try {
        const prestamoId = req.query.prestamoId;
        if (!prestamoId) {
            res.status(400).json({ error: "prestamoId es requerido" });
            return;
        }
        const prestamo = await connection_1.pool.query(`
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
            res.status(404).json({ error: "Préstamo no encontrado" });
            return;
        }
        const cuotas = await connection_1.pool.query(`
      SELECT
        cp.*,
        (CURRENT_DATE - cp.fecha_vence) AS dias_atraso
      FROM cuotas_prestamo cp
      WHERE cp.prestamo_id = $1
      ORDER BY cp.numero_cuota ASC
    `, [prestamoId]);
        const cobros = await connection_1.pool.query(`
      SELECT * FROM cobros_prestamos
      WHERE prestamo_id = $1
      ORDER BY created_at DESC
    `, [prestamoId]);
        res.json({
            prestamo: prestamo.rows[0],
            cuotas: cuotas.rows,
            cobros: cobros.rows,
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error en historial de préstamo" });
    }
});
exports.default = router;
// ════════════════════════════════════════════════════════════
// NOTA: "Préstamos refinanciados" y "Préstamos reestructurados" NO
// se implementan en esta tanda. Requieren funcionalidad de negocio
// nueva (PrestamoService.refinanciar()/reestructurar() + tabla
// prestamo_modificaciones) que se construirá por separado, fuera
// del alcance de "solo reportes".
// ════════════════════════════════════════════════════════════
//# sourceMappingURL=prestamos.js.map