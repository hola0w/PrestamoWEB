import { pool } from "../db/connection";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface FiltrosReporte {
  empresaId?: string | null;
  desde?: string;
  hasta?: string;
  clienteId?: string;
  prestamoId?: string;
  sucursalId?: string;
  cobradorId?: string;
  zonaId?: string;
  tipo?: string;          // tipo_plazo
  metodoPago?: string;
  rangoMora?: string;     // "1-30" | "31-60" | "61-90" | "90+"
}

// ─── Helpers compartidos (idénticos a los de los routers actuales) ─────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function esUuidValido(valor?: string): boolean {
  return !!valor && UUID_REGEX.test(valor);
}

/** Factor de cuotas reales según tipo_plazo (requiere alias p.tipo_plazo). */
const FACTOR_SQL = `
  CASE p.tipo_plazo
    WHEN 'QUINCENAL' THEN 2
    WHEN 'SEMANAL'   THEN 4
    WHEN 'DIARIO'    THEN 30
    ELSE 1
  END
`;

const TOTAL_PRESTAMO_SQL = `(p.cuota_mensual * p.plazo_meses * ${FACTOR_SQL})`;

/** Incluye PAGADO + PARCIAL + ATRASADO: todo lo que representa dinero recibido. */
const TOTAL_PAGADO_SQL = `
  COALESCE((
    SELECT SUM(cp.monto_pagado)
    FROM cobros_prestamos cp
    WHERE cp.prestamo_id = p.id
      AND cp.estado_cobro IN ('PAGADO', 'PARCIAL', 'ATRASADO')
  ), 0)
`;

const SALDO_PENDIENTE_SQL = `(${TOTAL_PRESTAMO_SQL} - ${TOTAL_PAGADO_SQL})`;

const SELECT_PRESTAMO_BASE = `
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
  ${TOTAL_PRESTAMO_SQL}  AS total_prestamo,
  ${TOTAL_PAGADO_SQL}    AS total_pagado,
  ${SALDO_PENDIENTE_SQL} AS saldo_pendiente
`;

const SELECT_COBRO_BASE = `
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

const FROM_COBRO_BASE = `
  FROM cobros_prestamos cp
  JOIN prestamos p     ON p.id  = cp.prestamo_id
  JOIN clientes  c     ON c.id  = p.cliente_id
  LEFT JOIN pagos pg   ON pg.id = cp.pago_id
`;

/** Condiciones comunes para reportes sobre `prestamos p JOIN clientes c`. */
function condicionesPrestamo(f: FiltrosReporte, opciones: { conRangoFecha?: boolean } = {}) {
  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (f.empresaId)  { conds.push(`p.empresa_id = $${i++}`); vals.push(f.empresaId); }
  if (opciones.conRangoFecha) {
    if (f.desde) { conds.push(`p.fecha_inicio >= $${i++}`); vals.push(f.desde); }
    if (f.hasta) { conds.push(`p.fecha_inicio <= $${i++}`); vals.push(f.hasta); }
  }
  if (f.clienteId)                { conds.push(`p.cliente_id  = $${i++}`); vals.push(f.clienteId); }
  if (esUuidValido(f.sucursalId)) { conds.push(`p.sucursal_id = $${i++}`); vals.push(f.sucursalId); }
  if (esUuidValido(f.cobradorId)) { conds.push(`p.cobrador_id = $${i++}`); vals.push(f.cobradorId); }
  if (esUuidValido(f.zonaId))     { conds.push(`c.zona_id     = $${i++}`); vals.push(f.zonaId); }
  if (f.tipo)                     { conds.push(`p.tipo_plazo  = $${i++}`); vals.push(f.tipo); }

  return { where: conds.length ? "WHERE " + conds.join(" AND ") : "", vals };
}

/** Condiciones comunes para reportes sobre `cobros_prestamos cp JOIN prestamos p ...`. */
function condicionesCobro(f: FiltrosReporte) {
  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (f.empresaId)  { conds.push(`p.empresa_id = $${i++}`);   vals.push(f.empresaId); }
  if (f.desde)       { conds.push(`cp.created_at >= $${i++}`); vals.push(f.desde); }
  if (f.hasta)       { conds.push(`cp.created_at <= $${i++}`); vals.push(f.hasta); }
  if (f.clienteId)   { conds.push(`p.cliente_id = $${i++}`);   vals.push(f.clienteId); }
  if (f.prestamoId)  { conds.push(`cp.prestamo_id = $${i++}`); vals.push(f.prestamoId); }
  if (f.metodoPago)  { conds.push(`pg.metodo_pago = $${i++}`); vals.push(f.metodoPago); }

  return { where: conds.length ? "WHERE " + conds.join(" AND ") : "", vals };
}

function condicionRangoMora(rangoMora: string | undefined, campoFecha = "cq.fecha_vence") {
  if (!rangoMora) return "";
  const rangos: Record<string, string> = {
    "1-30":  "BETWEEN 1 AND 30",
    "31-60": "BETWEEN 31 AND 60",
    "61-90": "BETWEEN 61 AND 90",
    "90+":   "> 90",
  };
  const cond = rangos[rangoMora];
  return cond ? `AND (CURRENT_DATE - ${campoFecha}) ${cond}` : "";
}

// ═════════════════════════════════════════════════════════════════════════
// SERVICIO
// ═════════════════════════════════════════════════════════════════════════

export class ReportesService {

  // ─── 1. CARTERA (routes/Reportes/cartera.ts) ──────────────────────────────

  async carteraGeneral(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });

    const detalle = await pool.query(`
      SELECT ${SELECT_PRESTAMO_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${where}
      ORDER BY p.fecha_inicio DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                                 AS total_prestamos,
        COALESCE(SUM(p.capital), 0)              AS capital_total,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)  AS total_a_cobrar,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)    AS total_cobrado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_total_pendiente
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${where}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  async carteraActiva(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });
    const whereFinal = where ? `${where} AND p.estado = 'ACTIVO'` : `WHERE p.estado = 'ACTIVO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_PRESTAMO_BASE}
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

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  async carteraVencida(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });
    const rangoCond = condicionRangoMora(f.rangoMora, "cq.fecha_vence");
    const whereFinal = where ? `${where} AND` : "WHERE";

    const detalle = await pool.query(`
      SELECT
        ${SELECT_PRESTAMO_BASE},
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
        COUNT(DISTINCT p.id)             AS prestamos_vencidos,
        COUNT(cq.id)                     AS total_cuotas_vencidas,
        COALESCE(SUM(cq.monto_cuota), 0) AS monto_total_vencido
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN cuotas_prestamo cq ON cq.prestamo_id = p.id
      ${whereFinal} cq.estado = 'PENDIENTE'
        AND cq.fecha_vence < CURRENT_DATE
        ${rangoCond}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  /** "Castigada" no existe como estado real: se usa CANCELADO como equivalente. */
  async carteraCastigada(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });
    const whereFinal = where ? `${where} AND p.estado = 'CANCELADO'` : `WHERE p.estado = 'CANCELADO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_PRESTAMO_BASE}
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

    return {
      detalle: detalle.rows,
      resumen: resumen.rows[0],
      nota: "Se usa estado CANCELADO como equivalente de cartera castigada.",
    };
  }

  async carteraPorTipo(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });

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

    return { porTipo: result.rows };
  }

  async carteraPorSucursal(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });

    const result = await pool.query(`
      SELECT
        s.id                                       AS sucursal_id,
        COALESCE(s.nombre, 'Sin sucursal')          AS sucursal_nombre,
        COUNT(p.id)                                 AS cantidad,
        COALESCE(SUM(p.capital), 0)                 AS capital_total,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0)     AS total_a_cobrar,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0)       AS total_cobrado,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0)    AS saldo_pendiente
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN sucursales s ON s.id = p.sucursal_id
      ${where}
      GROUP BY s.id, s.nombre
      ORDER BY total_a_cobrar DESC
    `, vals);

    return { porSucursal: result.rows };
  }

  async carteraPorZona(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });

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

    return { porZona: result.rows };
  }

  // ─── 2. PRÉSTAMOS (routes/Reportes/prestamos.ts) ──────────────────────────

  async prestamosActivos(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });
    const whereFinal = where ? `${where} AND p.estado = 'ACTIVO'` : `WHERE p.estado = 'ACTIVO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_PRESTAMO_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
      ORDER BY p.fecha_inicio DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                                 AS total_activos,
        COALESCE(SUM(p.capital), 0)              AS capital_total,
        COALESCE(SUM(${SALDO_PENDIENTE_SQL}), 0) AS saldo_pendiente_total
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  async prestamosFinalizados(f: FiltrosReporte) {
    const { where, vals } = condicionesPrestamo(f, { conRangoFecha: true });
    const whereFinal = where ? `${where} AND p.estado = 'PAGADO'` : `WHERE p.estado = 'PAGADO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_PRESTAMO_BASE}
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
      ORDER BY p.fecha_fin DESC NULLS LAST, p.fecha_inicio DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                              AS total_finalizados,
        COALESCE(SUM(p.capital), 0)           AS capital_total,
        COALESCE(SUM(${TOTAL_PAGADO_SQL}), 0) AS total_cobrado
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ${whereFinal}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  /** Sin JOIN a clientes — no se usa ninguna columna de esa tabla aquí. */
  async prestamosPorPeriodo(f: FiltrosReporte) {
    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (f.empresaId)  { conds.push(`p.empresa_id  = $${i++}`); vals.push(f.empresaId); }
    if (f.desde)       { conds.push(`p.fecha_inicio >= $${i++}`); vals.push(f.desde); }
    if (f.hasta)       { conds.push(`p.fecha_inicio <= $${i++}`); vals.push(f.hasta); }
    if (f.sucursalId)  { conds.push(`p.sucursal_id = $${i++}`); vals.push(f.sucursalId); }
    if (f.tipo)        { conds.push(`p.tipo_plazo  = $${i++}`); vals.push(f.tipo); }
    const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

    const result = await pool.query(`
      SELECT
        DATE_TRUNC('month', p.fecha_inicio)     AS mes,
        COUNT(*)                                AS cantidad,
        COALESCE(SUM(p.capital), 0)             AS capital_otorgado,
        COALESCE(SUM(${TOTAL_PRESTAMO_SQL}), 0) AS total_a_cobrar
      FROM prestamos p
      ${where}
      GROUP BY DATE_TRUNC('month', p.fecha_inicio)
      ORDER BY mes DESC
    `, vals);

    return { porMes: result.rows };
  }

  async prestamosHistorial(prestamoId: string) {
    const prestamo = await pool.query(`
      SELECT
        p.id, p.capital, p.interes_total, p.balance_pendiente, p.tasa_anual,
        p.mora_porcentaje, p.plazo_meses, p.cuota_mensual, p.tipo_plazo,
        p.garantia, p.observacion, p.estado, p.fecha_solicitud,
        p.fecha_aprobacion, p.fecha_inicio, p.fecha_fin, p.created_at, p.updated_at,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
        c.documento_identidad,
        c.email AS cliente_email,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono_principal
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.id = $1
    `, [prestamoId]);

    if (!prestamo.rows[0]) return null;

    const cuotas = await pool.query(`
      SELECT
        cp.id, cp.numero_cuota, cp.fecha_vence, cp.fecha_pago, cp.monto_cuota,
        cp.capital_pagado, cp.interes_pagado, cp.mora_pagada, cp.balance_restante,
        cp.dias_atraso, cp.estado,
        GREATEST(CURRENT_DATE - cp.fecha_vence, 0) AS dias_vencidos
      FROM cuotas_prestamo cp
      WHERE cp.prestamo_id = $1
      ORDER BY cp.numero_cuota ASC
    `, [prestamoId]);

    const cobros = await pool.query(`
      SELECT cb.id, cb.monto_pagado, cb.estado_cobro, cb.created_at, cb.updated_at, cb.empresa_id
      FROM cobros_prestamos cb
      WHERE cb.prestamo_id = $1
      ORDER BY cb.created_at DESC
    `, [prestamoId]);

    return { prestamo: prestamo.rows[0], cuotas: cuotas.rows, cobros: cobros.rows };
  }

  // ─── 3. COBROS (routes/Reportes/cobros.ts) ────────────────────────────────

  async cobrosRecibidos(f: FiltrosReporte) {
    const { where, vals } = condicionesCobro(f);
    const whereFinal = where ? `${where} AND cp.estado_cobro = 'PAGADO'` : `WHERE cp.estado_cobro = 'PAGADO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_COBRO_BASE} ${FROM_COBRO_BASE} ${whereFinal}
      ORDER BY cp.created_at DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                          AS total_cobros,
        COALESCE(SUM(cp.monto_pagado), 0) AS total_cobrado,
        COUNT(DISTINCT cp.prestamo_id)    AS prestamos_cobrados,
        COUNT(DISTINCT p.cliente_id)      AS clientes_cobrados
      ${FROM_COBRO_BASE} ${whereFinal}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  async cobrosParciales(f: FiltrosReporte) {
    const { where, vals } = condicionesCobro(f);
    const whereFinal = where ? `${where} AND cp.estado_cobro = 'PARCIAL'` : `WHERE cp.estado_cobro = 'PARCIAL'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_COBRO_BASE} ${FROM_COBRO_BASE} ${whereFinal}
      ORDER BY cp.created_at DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                          AS total_pagos_parciales,
        COALESCE(SUM(cp.monto_pagado), 0) AS monto_total_parcial
      ${FROM_COBRO_BASE} ${whereFinal}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  /** Alias semántico de cobrosRecibidos (mismo estado_cobro = PAGADO). */
  async cobrosCompletos(f: FiltrosReporte) {
    const { where, vals } = condicionesCobro(f);
    const whereFinal = where ? `${where} AND cp.estado_cobro = 'PAGADO'` : `WHERE cp.estado_cobro = 'PAGADO'`;

    const detalle = await pool.query(`
      SELECT ${SELECT_COBRO_BASE} ${FROM_COBRO_BASE} ${whereFinal}
      ORDER BY cp.created_at DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                          AS total_pagos_completos,
        COALESCE(SUM(cp.monto_pagado), 0) AS monto_total
      ${FROM_COBRO_BASE} ${whereFinal}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  /**
   * "Anticipado" = el cobro se aplicó a una cuota cuya fecha_vence aún no
   * había llegado al momento del pago. Requiere pagos.cuota_id poblado.
   */
  async cobrosAnticipados(f: FiltrosReporte) {
    const { where, vals } = condicionesCobro(f);
    const whereFinal = where
      ? `${where} AND cp.estado_cobro = 'PAGADO' AND cq.fecha_vence > pg.fecha_pago::date`
      : `WHERE cp.estado_cobro = 'PAGADO' AND cq.fecha_vence > pg.fecha_pago::date`;

    const detalle = await pool.query(`
      SELECT
        ${SELECT_COBRO_BASE},
        cq.fecha_vence,
        pg.fecha_pago,
        (cq.fecha_vence - pg.fecha_pago::date) AS dias_anticipacion
      ${FROM_COBRO_BASE}
      JOIN cuotas_prestamo cq ON cq.id = pg.cuota_id
      ${whereFinal}
      ORDER BY pg.fecha_pago DESC
    `, vals);

    const resumen = await pool.query(`
      SELECT
        COUNT(*)                          AS total_pagos_anticipados,
        COALESCE(SUM(cp.monto_pagado), 0) AS monto_total
      ${FROM_COBRO_BASE}
      JOIN cuotas_prestamo cq ON cq.id = pg.cuota_id
      ${whereFinal}
    `, vals);

    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  async cobrosPorMetodo(f: FiltrosReporte) {
    const { where, vals } = condicionesCobro(f);
    const whereFinal = where ? `${where} AND cp.estado_cobro = 'PAGADO'` : `WHERE cp.estado_cobro = 'PAGADO'`;

    const result = await pool.query(`
      SELECT
        COALESCE(pg.metodo_pago, 'Sin especificar') AS metodo_pago,
        COUNT(*)                                    AS cantidad,
        COALESCE(SUM(cp.monto_pagado), 0)           AS monto_total
      ${FROM_COBRO_BASE} ${whereFinal}
      GROUP BY pg.metodo_pago
      ORDER BY monto_total DESC
    `, vals);

    return { porMetodo: result.rows };
  }

  async cobrosHistorial(prestamoId: string) {
    const result = await pool.query(`
      SELECT ${SELECT_COBRO_BASE} ${FROM_COBRO_BASE}
      WHERE cp.prestamo_id = $1
      ORDER BY cp.created_at DESC
    `, [prestamoId]);

    return { detalle: result.rows };
  }

  // ─── 4. LEGACY (routes/Reportes/reportes.ts) ─────────────────────────────
  // Mantengo estos métodos por compatibilidad con el router genérico existente.
  // Donde el endpoint nuevo (cartera/cobros/prestamos) ya cubre lo mismo,
  // considera migrar ese router a llamar a esos métodos en su lugar.

  async legacyClientesDeuda() {
    const result = await pool.query(`
      SELECT
        c.id,
        CONCAT(c.nombres, ' ', c.apellidos) AS nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = FALSE LIMIT 1) AS telefono2,
        COUNT(p.id)                AS total_prestamos,
        SUM(p.capital)             AS capital_total,
        SUM(${SALDO_PENDIENTE_SQL}) AS deuda_total,
        SUM(${TOTAL_PAGADO_SQL})   AS total_pagado,
        COUNT(p.id) FILTER (WHERE p.estado = 'MOROSO') AS prestamos_morosos,
        COUNT(p.id) FILTER (WHERE p.estado = 'ACTIVO')  AS prestamos_activos
      FROM clientes c
      JOIN prestamos p ON p.cliente_id = c.id
      WHERE c.estado = 'ACTIVO' AND p.estado != 'PAGADO'
      GROUP BY c.id, c.nombres, c.apellidos
      ORDER BY deuda_total DESC
    `);
    return result.rows;
  }

  async legacyCuotasVencidas() {
    const detalle = await pool.query(`
      SELECT
        c.id AS cliente_id, CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
        (SELECT t.telefono FROM telefonos_clientes t
          WHERE t.cliente_id = c.id AND t.principal = TRUE LIMIT 1) AS telefono1,
        COUNT(cp.id) AS cuotas_vencidas,
        SUM(cp.monto_cuota) AS monto_vencido,
        MIN(cp.fecha_vence) AS primera_vencida,
        MAX(CURRENT_DATE - cp.fecha_vence) AS max_dias_atraso,
        p.tipo_plazo, p.capital, p.id AS prestamo_id
      FROM cuotas_prestamo cp
      JOIN prestamos p ON p.id = cp.prestamo_id
      JOIN clientes  c ON c.id = p.cliente_id
      WHERE cp.estado = 'PENDIENTE' AND cp.fecha_vence < CURRENT_DATE AND p.estado != 'PAGADO'
      GROUP BY c.id, c.nombres, c.apellidos, p.tipo_plazo, p.capital, p.id
      ORDER BY monto_vencido DESC
    `);
    const resumen = await pool.query(`
      SELECT
        COUNT(DISTINCT p.cliente_id) AS clientes_con_atraso,
        COUNT(cp.id)                 AS total_cuotas_vencidas,
        SUM(cp.monto_cuota)          AS monto_total_vencido
      FROM cuotas_prestamo cp
      JOIN prestamos p ON p.id = cp.prestamo_id
      WHERE cp.estado = 'PENDIENTE' AND cp.fecha_vence < CURRENT_DATE AND p.estado != 'PAGADO'
    `);
    return { detalle: detalle.rows, resumen: resumen.rows[0] };
  }

  async legacyIngresos(desde?: string, hasta?: string) {
    const conds: string[] = [];
    const vals: string[] = [];
    let i = 1;
    if (desde) { conds.push(`cq.fecha_pago >= $${i++}`); vals.push(desde); }
    if (hasta) { conds.push(`cq.fecha_pago <= $${i++}`); vals.push(hasta); }
    const where = conds.length ? "AND " + conds.join(" AND ") : "";

    const porMes = await pool.query(`
      SELECT
        DATE_TRUNC('month', cq.fecha_pago) AS mes,
        COUNT(cq.id)                       AS cuotas_cobradas,
        SUM(cq.monto_cuota)                AS cobrado_en_mes,
        COUNT(DISTINCT cq.prestamo_id)      AS prestamos_activos
      FROM cuotas_prestamo cq
      WHERE cq.estado = 'PAGADO' ${where}
      GROUP BY DATE_TRUNC('month', cq.fecha_pago)
      ORDER BY mes DESC
    `, vals);

    const totales = await pool.query(`
      SELECT
        SUM(p.capital) AS total_capital_prestado,
        SUM(p.cuota_mensual * p.plazo_meses) - SUM(p.capital) AS ganancia_total_proyectada,
        COALESCE((SELECT SUM(monto_cuota) FROM cuotas_prestamo WHERE estado = 'PAGADO'), 0) AS total_cobrado
      FROM prestamos p
    `);

    const cobradoPeriodo = await pool.query(`
      SELECT COALESCE(SUM(cq.monto_cuota), 0) AS cobrado_periodo
      FROM cuotas_prestamo cq
      WHERE cq.estado = 'PAGADO' ${where}
    `, vals);

    return {
      porMes: porMes.rows,
      totales: { ...totales.rows[0], cobrado_periodo: cobradoPeriodo.rows[0].cobrado_periodo },
    };
  }

  async legacyPrestamosLista() {
    const result = await pool.query(`
      SELECT p.id, CONCAT(c.nombres, ' ', c.apellidos) AS cliente_nombre,
             p.capital, p.estado, p.fecha_inicio, p.tipo_plazo
      FROM prestamos p
      JOIN clientes c ON c.id = p.cliente_id
      ORDER BY p.fecha_inicio DESC
    `);
    return result.rows;
  }
}

export default ReportesService;