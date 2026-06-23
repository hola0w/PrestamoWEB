import { Router } from "express";
import type { Request, Response } from "express";
import { CobrosService } from "../services/CobrosPrestamo";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const svc    = new CobrosService();

const ESTADOS_COBRO = ["PENDIENTE", "PAGADO", "PARCIAL", "ATRASADO"] as const;
type EstadoCobro    = typeof ESTADOS_COBRO[number];

function getUsuarioId(req: Request): string {
  return (req as any).user?.id as string;
}

// ─── GET /api/cobros ──────────────────────────────────────────
router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await svc.listarCobros());
  } catch {
    res.status(500).json({ error: "Error al obtener cobros" });
  }
});

// ─── GET /api/cobros/prestamo/:prestamoId/resumen ─────────────
router.get("/prestamo/:prestamoId/resumen", authMiddleware, async (req: Request, res: Response) => {
  try {
    const resumen = await svc.resumenPorPrestamo(req.params["prestamoId"] as string);
    if (!resumen) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
    res.json(resumen);
  } catch {
    res.status(500).json({ error: "Error al obtener resumen del préstamo" });
  }
});

// ─── GET /api/cobros/prestamo/:prestamoId ─────────────────────
router.get("/prestamo/:prestamoId", authMiddleware, async (req: Request, res: Response) => {
  try {
    res.json(await svc.listarPorPrestamo(req.params["prestamoId"] as string));
  } catch {
    res.status(500).json({ error: "Error al obtener cobros del préstamo" });
  }
});

// ─── GET /api/cobros/:id ──────────────────────────────────────
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const cobro = await svc.obtenerPorId(req.params["id"] as string);
    if (!cobro) { res.status(404).json({ error: "Cobro no encontrado" }); return; }
    res.json(cobro);
  } catch {
    res.status(500).json({ error: "Error al obtener cobro" });
  }
});

// ─── POST /api/cobros ─────────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { prestamoId, montoPagado } = req.body;

    if (!prestamoId || montoPagado == null) {
      res.status(400).json({ error: "prestamoId y montoPagado son requeridos" }); return;
    }
    if (typeof montoPagado !== "number" || montoPagado <= 0) {
      res.status(400).json({ error: "montoPagado debe ser un número mayor a 0" }); return;
    }

    const cobro = await svc.registrarCobro(
      prestamoId, montoPagado,
      getUsuarioId(req)   // ← created_by
    );
    if (!cobro) {
      res.status(400).json({ error: "Préstamo no encontrado o no está en estado ACTIVO" }); return;
    }
    res.status(201).json(cobro);
  } catch (err) {
    console.error("ERROR POST /api/cobros:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al registrar cobro" });
  }
});

// ─── PATCH /api/cobros/:id/estado ────────────────────────────
router.patch("/:id/estado", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { estado } = req.body;

    if (!estado) {
      res.status(400).json({ error: "estado es requerido" }); return;
    }
    if (!ESTADOS_COBRO.includes(estado as EstadoCobro)) {
      res.status(400).json({ error: `estado inválido. Valores permitidos: ${ESTADOS_COBRO.join(", ")}` }); return;
    }

    const updated = await svc.cambiarEstado(
      req.params["id"] as string,
      estado as EstadoCobro,
      getUsuarioId(req)   // ← updated_by
    );
    if (!updated) { res.status(404).json({ error: "Cobro no encontrado" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Error al cambiar estado del cobro" });
  }
});

export default router;