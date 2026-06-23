import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../db/connection";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Helper: extrae empresaId del JWT inyectado por authMiddleware.
function getEmpresaId(req: Request): string | null {
  return (req as any).user?.empresaId ?? null;
}

// ─── GET /api/zonas ─────────────────────────────────────────────
// Devuelve solo las zonas de la empresa del usuario logueado.
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);

    if (!empresaId) {
      res.json([]);
      return;
    }

    const result = await pool.query(
      `SELECT id, nombre, estado, created_at, updated_at
       FROM zonas
       WHERE empresa_id = $1 AND estado = TRUE
       ORDER BY nombre ASC`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al obtener zonas" });
  }
});

// ─── POST /api/zonas ────────────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) {
      res.status(400).json({ error: "Tu usuario no tiene una empresa asignada" });
      return;
    }

    const { nombre } = req.body;
    if (!nombre) {
      res.status(400).json({ error: "nombre es requerido" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO zonas (empresa_id, nombre)
       VALUES ($1, $2)
       RETURNING id, nombre, estado, created_at, updated_at`,
      [empresaId, nombre]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error &&
        (error as { code: string }).code === "23505") {
      res.status(409).json({ error: "Ya existe una zona con ese nombre en tu empresa" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error al crear zona" });
  }
});

// ─── PATCH /api/zonas/:id ───────────────────────────────────────
router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);
    const id = req.params["id"] as string;
    const { nombre, estado } = req.body;

    if (!nombre && estado == null) {
      res.status(400).json({ error: "Debes enviar al menos un campo para actualizar" });
      return;
    }

    const result = await pool.query(
      `UPDATE zonas
       SET nombre = COALESCE($1, nombre),
           estado = COALESCE($2, estado)
       WHERE id = $3 AND empresa_id = $4
       RETURNING id, nombre, estado, created_at, updated_at`,
      [nombre, estado, id, empresaId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Zona no encontrada" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error &&
        (error as { code: string }).code === "23505") {
      res.status(409).json({ error: "Ya existe una zona con ese nombre en tu empresa" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Error al actualizar zona" });
  }
});

// ─── DELETE /api/zonas/:id ───────────────────────────────────────
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const empresaId = getEmpresaId(req);
    const id = req.params["id"] as string;

    const result = await pool.query(
      `UPDATE zonas
       SET estado = FALSE
       WHERE id = $1 AND empresa_id = $2
       RETURNING id`,
      [id, empresaId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Zona no encontrada" });
      return;
    }
    res.json({ message: "Zona inactivada correctamente" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al inactivar zona" });
  }
});

export default router;