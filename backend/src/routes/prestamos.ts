import { Router } from "express";
import type { Request, Response } from "express";
import { PrestamoService } from "../services/prestamoService";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const svc    = new PrestamoService();

const ESTADOS_VALIDOS = ["PENDIENTE", "APROBADO", "ACTIVO", "PAGADO", "MOROSO", "CANCELADO"] as const;
const TIPOS_PLAZO     = ["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"] as const;
type EstadoPrestamo   = typeof ESTADOS_VALIDOS[number];
type TipoPlazo        = typeof TIPOS_PLAZO[number];

// Helper para extraer el usuarioId del JWT inyectado por authMiddleware
function getUsuarioId(req: Request): string {
  return (req as any).user?.id as string;
}

// ─── GET /api/prestamos ───────────────────────────────────────
router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await svc.listarPrestamos());
  } catch {
    res.status(500).json({ error: "Error al obtener préstamos" });
  }
});

// ─── GET /api/prestamos/cliente/:clienteId ────────────────────
// IMPORTANTE: antes de /:id para que Express no la confunda
router.get("/cliente/:clienteId", authMiddleware, async (req: Request, res: Response) => {
  try {
    res.json(await svc.listarPorCliente(req.params["clienteId"] as string));
  } catch {
    res.status(500).json({ error: "Error al obtener préstamos del cliente" });
  }
});

// ─── GET /api/prestamos/:id ───────────────────────────────────
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const prestamo = await svc.obtenerPorId(req.params["id"] as string);
    if (!prestamo) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
    res.json(prestamo);
  } catch {
    res.status(500).json({ error: "Error al obtener préstamo" });
  }
});

// ─── POST /api/prestamos ──────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { clienteId, capital, tasaAnual, plazoMeses, tipoPlazo } = req.body;

    if (!clienteId || capital == null || tasaAnual == null || plazoMeses == null) {
      res.status(400).json({ error: "clienteId, capital, tasaAnual y plazoMeses son requeridos" }); return;
    }
    if (typeof capital !== "number" || capital <= 0) {
      res.status(400).json({ error: "capital debe ser un número mayor a 0" }); return;
    }
    if (typeof tasaAnual !== "number" || tasaAnual < 0) {
      res.status(400).json({ error: "tasaAnual debe ser >= 0" }); return;
    }
    if (!Number.isInteger(plazoMeses) || plazoMeses <= 0) {
      res.status(400).json({ error: "plazoMeses debe ser un entero mayor a 0" }); return;
    }

    const tipo: TipoPlazo = tipoPlazo ?? "MENSUAL";
    if (!TIPOS_PLAZO.includes(tipo)) {
      res.status(400).json({ error: `tipoPlazo inválido. Valores: ${TIPOS_PLAZO.join(", ")}` }); return;
    }

    const prestamo = await svc.crearPrestamo(
      clienteId, capital, tasaAnual, plazoMeses, tipo,
      getUsuarioId(req)   // ← quién lo crea (created_by)
    );
    if (!prestamo) {
      res.status(400).json({ error: "Score insuficiente o cliente no encontrado" }); return;
    }
    res.status(201).json(prestamo);
  } catch (err) {
    console.error("ERROR POST /api/prestamos:", err);
    res.status(500).json({ error: "Error al crear préstamo" });
  }
});

// ─── PATCH /api/prestamos/:id/estado ─────────────────────────
router.patch("/:id/estado", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { estado } = req.body;

    if (!estado || !ESTADOS_VALIDOS.includes(estado as EstadoPrestamo)) {
      res.status(400).json({ error: `estado inválido. Valores: ${ESTADOS_VALIDOS.join(", ")}` }); return;
    }

    const updated = await svc.cambiarEstado(
      req.params["id"] as string,
      estado as EstadoPrestamo,
      getUsuarioId(req)   // ← quién lo modifica (updated_by)
    );
    if (!updated) { res.status(404).json({ error: "Préstamo no encontrado" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Error al cambiar estado del préstamo" });
  }
});

export default router;