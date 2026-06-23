"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CobrosPrestamo_1 = require("../services/CobrosPrestamo");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const svc = new CobrosPrestamo_1.CobrosService();
const ESTADOS_COBRO = ["PENDIENTE", "PAGADO", "PARCIAL", "ATRASADO"];
function getUsuarioId(req) {
    return req.user?.id;
}
// ─── GET /api/cobros ──────────────────────────────────────────
router.get("/", auth_1.authMiddleware, async (_req, res) => {
    try {
        res.json(await svc.listarCobros());
    }
    catch {
        res.status(500).json({ error: "Error al obtener cobros" });
    }
});
// ─── GET /api/cobros/prestamo/:prestamoId/resumen ─────────────
router.get("/prestamo/:prestamoId/resumen", auth_1.authMiddleware, async (req, res) => {
    try {
        const resumen = await svc.resumenPorPrestamo(req.params["prestamoId"]);
        if (!resumen) {
            res.status(404).json({ error: "Préstamo no encontrado" });
            return;
        }
        res.json(resumen);
    }
    catch {
        res.status(500).json({ error: "Error al obtener resumen del préstamo" });
    }
});
// ─── GET /api/cobros/prestamo/:prestamoId ─────────────────────
router.get("/prestamo/:prestamoId", auth_1.authMiddleware, async (req, res) => {
    try {
        res.json(await svc.listarPorPrestamo(req.params["prestamoId"]));
    }
    catch {
        res.status(500).json({ error: "Error al obtener cobros del préstamo" });
    }
});
// ─── GET /api/cobros/:id ──────────────────────────────────────
router.get("/:id", auth_1.authMiddleware, async (req, res) => {
    try {
        const cobro = await svc.obtenerPorId(req.params["id"]);
        if (!cobro) {
            res.status(404).json({ error: "Cobro no encontrado" });
            return;
        }
        res.json(cobro);
    }
    catch {
        res.status(500).json({ error: "Error al obtener cobro" });
    }
});
// ─── POST /api/cobros ─────────────────────────────────────────
router.post("/", auth_1.authMiddleware, async (req, res) => {
    try {
        const { prestamoId, montoPagado } = req.body;
        if (!prestamoId || montoPagado == null) {
            res.status(400).json({ error: "prestamoId y montoPagado son requeridos" });
            return;
        }
        if (typeof montoPagado !== "number" || montoPagado <= 0) {
            res.status(400).json({ error: "montoPagado debe ser un número mayor a 0" });
            return;
        }
        const cobro = await svc.registrarCobro(prestamoId, montoPagado, getUsuarioId(req) // ← created_by
        );
        if (!cobro) {
            res.status(400).json({ error: "Préstamo no encontrado o no está en estado ACTIVO" });
            return;
        }
        res.status(201).json(cobro);
    }
    catch (err) {
        console.error("ERROR POST /api/cobros:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "Error al registrar cobro" });
    }
});
// ─── PATCH /api/cobros/:id/estado ────────────────────────────
router.patch("/:id/estado", auth_1.authMiddleware, async (req, res) => {
    try {
        const { estado } = req.body;
        if (!estado) {
            res.status(400).json({ error: "estado es requerido" });
            return;
        }
        if (!ESTADOS_COBRO.includes(estado)) {
            res.status(400).json({ error: `estado inválido. Valores permitidos: ${ESTADOS_COBRO.join(", ")}` });
            return;
        }
        const updated = await svc.cambiarEstado(req.params["id"], estado, getUsuarioId(req) // ← updated_by
        );
        if (!updated) {
            res.status(404).json({ error: "Cobro no encontrado" });
            return;
        }
        res.json(updated);
    }
    catch {
        res.status(500).json({ error: "Error al cambiar estado del cobro" });
    }
});
exports.default = router;
//# sourceMappingURL=cobro.js.map