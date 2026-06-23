"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrestamoService = void 0;
const connection_1 = require("../db/connection");
// ─── Helper ───────────────────────────────────────────────────
function cuotasPorMes(tipoPlazo) {
    const map = {
        MENSUAL: 1, QUINCENAL: 2, SEMANAL: 4, DIARIO: 30,
    };
    return map[tipoPlazo] ?? 1;
}
class PrestamoService {
    // ─── Cálculo de cuota ──────────────────────────────────────
    calcularCuota(capital, tasaAnual, plazoMeses, tipoPlazo = "MENSUAL") {
        const factor = cuotasPorMes(tipoPlazo);
        const totalCuotas = plazoMeses * factor;
        if (tasaAnual === 0) {
            return +(capital / totalCuotas).toFixed(2);
        }
        const r = (tasaAnual / 100) / 12 / factor;
        return +((capital * (r * Math.pow(1 + r, totalCuotas))) / (Math.pow(1 + r, totalCuotas) - 1)).toFixed(2);
    }
    // ─── Crear préstamo ────────────────────────────────────────
    async crearPrestamo(clienteId, capital, tasaAnual, plazoMeses, tipoPlazo = "MENSUAL", usuarioId, observacion) {
        // Validar cliente activo con score suficiente
        const clienteRes = await connection_1.pool.query(`SELECT score FROM clientes WHERE id = $1 AND estado = 'ACTIVO'`, [clienteId]);
        if (!clienteRes.rows[0] || (clienteRes.rows[0].score ?? 0) < 600)
            return null;
        const cuota = this.calcularCuota(capital, tasaAnual, plazoMeses, tipoPlazo);
        const totalCuotas = plazoMeses * cuotasPorMes(tipoPlazo);
        const balancePendiente = +(cuota * totalCuotas).toFixed(2);
        const interesTotal = +(balancePendiente - capital).toFixed(2);
        const res = await connection_1.pool.query(`INSERT INTO prestamos
         (cliente_id, capital, tasa_anual, plazo_meses, cuota_mensual,
          tipo_plazo, estado, fecha_inicio, balance_pendiente,
          interes_total, observacion, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE',CURRENT_DATE,$7,$8,$9,$10)
       RETURNING *`, [
            clienteId, capital, tasaAnual, plazoMeses, cuota,
            tipoPlazo, balancePendiente, interesTotal,
            observacion ?? null, usuarioId,
        ]);
        return res.rows[0];
    }
    // ─── Listar todos ──────────────────────────────────────────
    async listarPrestamos() {
        const res = await connection_1.pool.query(`
      SELECT
        p.*,
        CONCAT(c.nombres, ' ', c.apellidos)                             AS cliente_nombre,
        c.documento_identidad,
        CONCAT('PRE-', LPAD(ROW_NUMBER() OVER (ORDER BY p.fecha_inicio)::text, 6, '0'))
                                                                        AS codigo,
        COALESCE((
          SELECT SUM(cp.monto_pagado)
          FROM cobros_prestamos cp
          WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
        ), 0)                                                           AS total_pagado,
        (p.cuota_mensual * p.plazo_meses) - COALESCE((
          SELECT SUM(cp.monto_pagado)
          FROM cobros_prestamos cp
          WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
        ), 0)                                                           AS monto_restante,
        u.nombre                                                        AS creado_por_nombre
      FROM prestamos p
      JOIN clientes  c ON c.id = p.cliente_id
      LEFT JOIN usuarios u ON u.id = p.created_by
      ORDER BY p.fecha_inicio DESC
    `);
        return res.rows;
    }
    // ─── Obtener por ID ────────────────────────────────────────
    async obtenerPorId(id) {
        const res = await connection_1.pool.query(`
      SELECT
        p.*,
        CONCAT(c.nombres, ' ', c.apellidos)   AS cliente_nombre,
        c.documento_identidad,
        COALESCE((
          SELECT SUM(cp.monto_pagado)
          FROM cobros_prestamos cp
          WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
        ), 0)                                 AS total_pagado,
        (p.cuota_mensual * p.plazo_meses) - COALESCE((
          SELECT SUM(cp.monto_pagado)
          FROM cobros_prestamos cp
          WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
        ), 0)                                 AS monto_restante,
        uc.nombre                             AS creado_por_nombre,
        uu.nombre                             AS modificado_por_nombre
      FROM prestamos p
      JOIN clientes  c  ON c.id  = p.cliente_id
      LEFT JOIN usuarios uc ON uc.id = p.created_by
      LEFT JOIN usuarios uu ON uu.id = p.updated_by
      WHERE p.id = $1
    `, [id]);
        return res.rows[0] ?? null;
    }
    // ─── Listar por cliente ────────────────────────────────────
    async listarPorCliente(clienteId) {
        const res = await connection_1.pool.query(`
      SELECT
        p.*,
        CONCAT(c.nombres, ' ', c.apellidos)   AS cliente_nombre,
        COALESCE((
          SELECT SUM(cp.monto_pagado)
          FROM cobros_prestamos cp
          WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
        ), 0)                                 AS total_pagado,
        (p.cuota_mensual * p.plazo_meses) - COALESCE((
          SELECT SUM(cp.monto_pagado)
          FROM cobros_prestamos cp
          WHERE cp.prestamo_id = p.id AND cp.estado_cobro = 'PAGADO'
        ), 0)                                 AS monto_restante
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.cliente_id = $1
      ORDER BY p.fecha_inicio DESC
    `, [clienteId]);
        return res.rows;
    }
    // ─── Cambiar estado ────────────────────────────────────────
    async cambiarEstado(prestamoId, estado, usuarioId) {
        const res = await connection_1.pool.query(`UPDATE prestamos
       SET
         estado     = $1,
         updated_by = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`, [estado, usuarioId, prestamoId]);
        return res.rows[0] ?? null;
    }
}
exports.PrestamoService = PrestamoService;
//# sourceMappingURL=prestamoService.js.map