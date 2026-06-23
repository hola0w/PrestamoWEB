"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prestamoService_1 = require("../services/prestamoService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const svc = new prestamoService_1.PrestamoService();
const ESTADOS_VALIDOS = ["PENDIENTE", "APROBADO", "ACTIVO", "PAGADO", "MOROSO", "CANCELADO"];
const TIPOS_PLAZO = ["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"];
// Helper para extraer el usuarioId del JWT inyectado por authMiddleware
function getUsuarioId(req) {
    return req.user?.id;
}
// ─── GET /api/prestamos ───────────────────────────────────────
router.get("/", auth_1.authMiddleware, async (_req, res) => {
    try {
        res.json(await svc.listarPrestamos());
    }
    catch {
        res.status(500).json({ error: "Error al obtener préstamos" });
    }
});
// ─── GET /api/prestamos/cliente/:clienteId ────────────────────
// IMPORTANTE: antes de /:id para que Express no la confunda
router.get("/cliente/:clienteId", auth_1.authMiddleware, async (req, res) => {
    try {
        res.json(await svc.listarPorCliente(req.params["clienteId"]));
    }
    catch {
        res.status(500).json({ error: "Error al obtener préstamos del cliente" });
    }
});
// ─── GET /api/prestamos/:id ───────────────────────────────────
router.get("/:id", auth_1.authMiddleware, async (req, res) => {
    try {
        const prestamo = await svc.obtenerPorId(req.params["id"]);
        if (!prestamo) {
            res.status(404).json({ error: "Préstamo no encontrado" });
            return;
        }
        res.json(prestamo);
    }
    catch {
        res.status(500).json({ error: "Error al obtener préstamo" });
    }
});
// ─── POST /api/prestamos ──────────────────────────────────────
router.post("/", auth_1.authMiddleware, async (req, res) => {
    try {
        const { clienteId, capital, tasaAnual, plazoMeses, tipoPlazo } = req.body;
        if (!clienteId || capital == null || tasaAnual == null || plazoMeses == null) {
            res.status(400).json({ error: "clienteId, capital, tasaAnual y plazoMeses son requeridos" });
            return;
        }
        if (typeof capital !== "number" || capital <= 0) {
            res.status(400).json({ error: "capital debe ser un número mayor a 0" });
            return;
        }
        if (typeof tasaAnual !== "number" || tasaAnual < 0) {
            res.status(400).json({ error: "tasaAnual debe ser >= 0" });
            return;
        }
        if (!Number.isInteger(plazoMeses) || plazoMeses <= 0) {
            res.status(400).json({ error: "plazoMeses debe ser un entero mayor a 0" });
            return;
        }
        const tipo = tipoPlazo ?? "MENSUAL";
        if (!TIPOS_PLAZO.includes(tipo)) {
            res.status(400).json({ error: `tipoPlazo inválido. Valores: ${TIPOS_PLAZO.join(", ")}` });
            return;
        }
        const prestamo = await svc.crearPrestamo(clienteId, capital, tasaAnual, plazoMeses, tipo, getUsuarioId(req) // ← quién lo crea (created_by)
        );
        if (!prestamo) {
            res.status(400).json({ error: "Score insuficiente o cliente no encontrado" });
            return;
        }
        res.status(201).json(prestamo);
    }
    catch (err) {
        console.error("ERROR POST /api/prestamos:", err);
        res.status(500).json({ error: "Error al crear préstamo" });
    }
});
// ─── PATCH /api/prestamos/:id/estado ─────────────────────────
router.patch("/:id/estado", auth_1.authMiddleware, async (req, res) => {
    try {
        const { estado } = req.body;
        if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
            res.status(400).json({ error: `estado inválido. Valores: ${ESTADOS_VALIDOS.join(", ")}` });
            return;
        }
        const updated = await svc.cambiarEstado(req.params["id"], estado, getUsuarioId(req) // ← quién lo modifica (updated_by)
        );
        if (!updated) {
            res.status(404).json({ error: "Préstamo no encontrado" });
            return;
        }
        res.json(updated);
    }
    catch {
        res.status(500).json({ error: "Error al cambiar estado del préstamo" });
    }
});
exports.default = router;
//# sourceMappingURL=prestamos.js.map