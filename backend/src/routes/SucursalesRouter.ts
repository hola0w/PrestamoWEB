import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../db/connection";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Helper: extrae empresaId del JWT inyectado por authMiddleware.
// Ver authRouter.ts -> el payload firmado incluye `empresaId`.
function getEmpresaId(req: Request): string | null {
  return (req as any).user?.empresaId ?? null;
}

// ─── GET /api/sucursales ───────────────────────────────────────
// Devuelve solo las sucursales de la empresa del usuario logueado.
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);

    if (!empresaId) {
      // Usuario sin empresa asignada (ej. admin global): no hay
      // sucursales que listar todavía.
      res.json([]);
      return;
    }

    const result = await pool.query(
      `SELECT id, nombre, direccion, estado, created_at, updated_at
       FROM sucursales
       WHERE empresa_id = $1 AND estado = TRUE
       ORDER BY nombre ASC`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener sucursales" });
  }
});

// ─── POST /api/sucursales ──────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      res.status(400).json({ error: "Tu usuario no tiene una empresa asignada" });
      return;
    }

    const { nombre, direccion } = req.body;
    if (!nombre) {
      res.status(400).json({ error: "nombre es requerido" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO sucursales (empresa_id, nombre, direccion)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, direccion, estado, created_at, updated_at`,
      [empresaId, nombre, direccion ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error &&
        (error as { code: string }).code === "23505") {
      res.status(409).json({ error: "Ya existe una sucursal con ese nombre en tu empresa" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error al crear sucursal" });
  }
});

// ─── PATCH /api/sucursales/:id ─────────────────────────────────
router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);
    const id = req.params["id"] as string;
    const { nombre, direccion, estado } = req.body;

    if (!nombre && !direccion && estado == null) {
      res.status(400).json({ error: "Debes enviar al menos un campo para actualizar" });
      return;
    }

    const result = await pool.query(
      `UPDATE sucursales
       SET nombre    = COALESCE($1, nombre),
           direccion = COALESCE($2, direccion),
           estado    = COALESCE($3, estado)
       WHERE id = $4 AND empresa_id = $5
       RETURNING id, nombre, direccion, estado, created_at, updated_at`,
      [nombre, direccion, estado, id, empresaId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Sucursal no encontrada" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error &&
        (error as { code: string }).code === "23505") {
      res.status(409).json({ error: "Ya existe una sucursal con ese nombre en tu empresa" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error al actualizar sucursal" });
  }
});

// ─── DELETE /api/sucursales/:id ────────────────────────────────
// Inactivación lógica (igual patrón que clientes), no borra el registro.
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);
    const id = req.params["id"] as string;

    const result = await pool.query(
      `UPDATE sucursales
       SET estado = FALSE
       WHERE id = $1 AND empresa_id = $2
       RETURNING id`,
      [id, empresaId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Sucursal no encontrada" });
      return;
    }
    res.json({ message: "Sucursal inactivada correctamente" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al inactivar sucursal" });
  }
});

export default router;