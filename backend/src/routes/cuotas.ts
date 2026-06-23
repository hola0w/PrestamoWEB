import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../db/connection";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/resumen", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)  FILTER (WHERE cp.estado = 'PENDIENTE')                           AS total_pendiente,
        COUNT(*)  FILTER (WHERE cp.estado = 'PENDIENTE'
                            AND cp.fecha_vence = CURRENT_DATE)                     AS vencen_hoy,
        COUNT(*)  FILTER (WHERE cp.estado = 'PENDIENTE'
                            AND cp.fecha_vence < CURRENT_DATE)                     AS vencidas,
        COUNT(*)  FILTER (WHERE cp.estado = 'PAGADO')                              AS total_pagadas,
        COALESCE(SUM(cp.monto_cuota) FILTER (WHERE cp.estado = 'PENDIENTE'), 0)    AS monto_pendiente,
        COALESCE(SUM(cp.monto_cuota) FILTER (WHERE cp.estado = 'PENDIENTE'
                    AND cp.fecha_vence = CURRENT_DATE), 0)                         AS monto_hoy,
        COALESCE(SUM(cp.monto_cuota) FILTER (WHERE cp.estado = 'PENDIENTE'
                    AND cp.fecha_vence < CURRENT_DATE), 0)                         AS monto_vencido,
        COALESCE(SUM(cp.monto_cuota) FILTER (WHERE cp.estado = 'PAGADO'), 0)       AS monto_cobrado
      FROM cuotas_prestamo cp
      JOIN prestamos p ON p.id = cp.prestamo_id
      WHERE p.estado != 'PAGADO'
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("ERROR GET /api/cuotas/resumen:", error);
    res.status(500).json({ error: "Error al obtener resumen" });
  }
});

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { estado, fechaDesde, fechaHasta } = req.query;
    const conditions: string[] = [];
    const params: unknown[]    = [];
    let i = 1;

    if (estado && estado !== "TODOS") { conditions.push(`cp.estado = $${i++}`); params.push(estado); }
    if (fechaDesde) { conditions.push(`cp.fecha_vence >= $${i++}`); params.push(fechaDesde); }
    if (fechaHasta) { conditions.push(`cp.fecha_vence <= $${i++}`); params.push(fechaHasta); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT
        cp.*,
        p.capital, p.tasa_anual, p.plazo_meses, p.tipo_plazo, p.cuota_mensual,
        p.estado                                                    AS estado_prestamo,
        CONCAT(c.nombres, ' ', c.apellidos)                        AS cliente_nombre,
        (SELECT t.telefono FROM telefonos_clientes t
         WHERE t.cliente_id = c.id AND t.principal = true LIMIT 1) AS telefono1,
        (CURRENT_DATE - cp.fecha_vence)                            AS dias_atraso
      FROM cuotas_prestamo cp
      JOIN prestamos p ON p.id = cp.prestamo_id
      JOIN clientes  c ON c.id = p.cliente_id
      ${where}
      ORDER BY cp.fecha_vence ASC, c.nombres ASC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET /api/cuotas:", error);
    res.status(500).json({ error: "Error al obtener cuotas" });
  }
});

router.patch("/:id/pagar", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const result = await pool.query(`
      UPDATE cuotas_prestamo
      SET estado    = 'PAGADO',
          fecha_pago = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
    if (!result.rows[0]) { res.status(404).json({ error: "Cuota no encontrada" }); return; }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("ERROR PATCH /api/cuotas/:id/pagar:", error);
    res.status(500).json({ error: "Error al marcar cuota como pagada" });
  }
});

export default router;