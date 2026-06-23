"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CobrosService = void 0;
const connection_1 = require("../db/connection");
class CobrosService {
    // ─── Registrar cobro ───────────────────────────────────────
    async registrarCobro(prestamoId, montoPagado, usuarioId) {
        // Solo se puede cobrar si el préstamo existe y no está terminado
        const prestamo = await connection_1.pool.query(`SELECT id, cuota_mensual, estado
       FROM prestamos
       WHERE id = $1 AND estado NOT IN ('PAGADO', 'CANCELADO', 'PENDIENTE')`, [prestamoId]);
        if (!prestamo.rows[0])
            return null;
        const res = await connection_1.pool.query(`INSERT INTO cobros_prestamos
         (prestamo_id, monto_pagado, estado_cobro, created_by)
       VALUES ($1, $2, 'PAGADO', $3)
       RETURNING *`, [prestamoId, montoPagado, usuarioId]);
        return res.rows[0];
    }
    // ─── Listar todos ──────────────────────────────────────────
    async listarCobros() {
        const res = await connection_1.pool.query(`
      SELECT
        cp.*,
        p.capital,
        p.cuota_mensual,
        p.estado                                    AS estado_prestamo,
        CONCAT(c.nombres, ' ', c.apellidos)         AS cliente_nombre,
        c.documento_identidad,
        uc.nombre                                   AS creado_por_nombre,
        uu.nombre                                   AS modificado_por_nombre
      FROM cobros_prestamos cp
      JOIN prestamos  p  ON p.id  = cp.prestamo_id
      JOIN clientes   c  ON c.id  = p.cliente_id
      LEFT JOIN usuarios uc ON uc.id = cp.created_by
      LEFT JOIN usuarios uu ON uu.id = cp.updated_by
      ORDER BY cp.created_at DESC
    `);
        return res.rows;
    }
    // ─── Listar por préstamo ───────────────────────────────────
    async listarPorPrestamo(prestamoId) {
        const res = await connection_1.pool.query(`
      SELECT
        cp.*,
        p.capital,
        p.cuota_mensual,
        CONCAT(c.nombres, ' ', c.apellidos)         AS cliente_nombre,
        uc.nombre                                   AS creado_por_nombre,
        uu.nombre                                   AS modificado_por_nombre
      FROM cobros_prestamos cp
      JOIN prestamos  p  ON p.id  = cp.prestamo_id
      JOIN clientes   c  ON c.id  = p.cliente_id
      LEFT JOIN usuarios uc ON uc.id = cp.created_by
      LEFT JOIN usuarios uu ON uu.id = cp.updated_by
      WHERE cp.prestamo_id = $1
      ORDER BY cp.created_at DESC
    `, [prestamoId]);
        return res.rows;
    }
    // ─── Obtener por ID ────────────────────────────────────────
    async obtenerPorId(id) {
        const res = await connection_1.pool.query(`
      SELECT
        cp.*,
        p.capital,
        p.cuota_mensual,
        p.estado                                    AS estado_prestamo,
        CONCAT(c.nombres, ' ', c.apellidos)         AS cliente_nombre,
        c.documento_identidad,
        uc.nombre                                   AS creado_por_nombre,
        uu.nombre                                   AS modificado_por_nombre
      FROM cobros_prestamos cp
      JOIN prestamos  p  ON p.id  = cp.prestamo_id
      JOIN clientes   c  ON c.id  = p.cliente_id
      LEFT JOIN usuarios uc ON uc.id = cp.created_by
      LEFT JOIN usuarios uu ON uu.id = cp.updated_by
      WHERE cp.id = $1
    `, [id]);
        return res.rows[0] ?? null;
    }
    // ─── Cambiar estado ────────────────────────────────────────
    async cambiarEstado(id, estado, usuarioId) {
        const res = await connection_1.pool.query(`UPDATE cobros_prestamos
       SET
         estado_cobro = $1,
         updated_by   = $2,
         updated_at   = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`, [estado, usuarioId, id]);
        return res.rows[0] ?? null;
    }
    // ─── Resumen por préstamo ──────────────────────────────────
    async resumenPorPrestamo(prestamoId) {
        const res = await connection_1.pool.query(`
      SELECT
        p.id                                                              AS prestamo_id,
        p.capital,
        p.tasa_anual,
        p.plazo_meses,
        p.cuota_mensual,
        p.tipo_plazo,
        p.estado                                                          AS estado_prestamo,
        p.cuota_mensual * p.plazo_meses                                  AS total_a_pagar,
        COALESCE(SUM(cp.monto_pagado)
          FILTER (WHERE cp.estado_cobro = 'PAGADO'),   0)                AS total_pagado,
        (p.cuota_mensual * p.plazo_meses) - COALESCE(SUM(cp.monto_pagado)
          FILTER (WHERE cp.estado_cobro = 'PAGADO'),   0)                AS saldo_pendiente,
        COUNT(cp.id) FILTER (WHERE cp.estado_cobro = 'PAGADO')           AS cobros_pagados,
        COUNT(cp.id) FILTER (WHERE cp.estado_cobro = 'PARCIAL')          AS cobros_parciales,
        COUNT(cp.id) FILTER (WHERE cp.estado_cobro = 'PENDIENTE')        AS cobros_pendientes,
        COUNT(cp.id) FILTER (WHERE cp.estado_cobro = 'ATRASADO')         AS cobros_atrasados
      FROM prestamos p
      LEFT JOIN cobros_prestamos cp ON cp.prestamo_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [prestamoId]);
        return res.rows[0] ?? null;
    }
}
exports.CobrosService = CobrosService;
//# sourceMappingURL=CobrosPrestamo.js.map