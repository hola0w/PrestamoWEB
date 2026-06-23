"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuarioRouter = void 0;
const express_1 = require("express");
const UsuarioService_1 = require("../services/UsuarioService");
exports.usuarioRouter = (0, express_1.Router)();
const svc = new UsuarioService_1.UsuarioService();
// ── Middleware: solo ADMINISTRADOR ────────────────────────────
function soloAdmin(req, res, next) {
    const user = req.user;
    if (!user || user.rol !== "ADMINISTRADOR") {
        return res.status(403).json({ error: "Acceso denegado. Se requiere rol ADMINISTRADOR." });
    }
    next();
}
// Helper para extraer usuarioId del JWT
function getUsuarioId(req) {
    return req.user?.id;
}
// ── GET /api/usuarios — lista ESTANDAR ───────────────────────
exports.usuarioRouter.get("/", soloAdmin, async (_req, res) => {
    try {
        res.json(await svc.listarEstandar());
    }
    catch (e) {
        res.status(500).json({ error: e.message ?? "Error al listar usuarios" });
    }
});
// ── GET /api/usuarios/todos — lista todos ────────────────────
exports.usuarioRouter.get("/todos", soloAdmin, async (_req, res) => {
    try {
        res.json(await svc.listarTodos());
    }
    catch (e) {
        res.status(500).json({ error: e.message ?? "Error" });
    }
});
// ── GET /api/usuarios/:id ─────────────────────────────────────
exports.usuarioRouter.get("/:id", soloAdmin, async (req, res) => {
    try {
        const u = await svc.obtenerPorId(req.params["id"]);
        if (!u)
            return res.status(404).json({ error: "Usuario no encontrado" });
        res.json(u);
    }
    catch (e) {
        res.status(500).json({ error: e.message ?? "Error" });
    }
});
// ── POST /api/usuarios — crear ESTANDAR ──────────────────────
exports.usuarioRouter.post("/", soloAdmin, async (req, res) => {
    const { nombre, username, password, permisos, estado } = req.body;
    if (!nombre || !password) {
        return res.status(400).json({ error: "nombre y password son requeridos" });
    }
    try {
        const nuevo = await svc.crear({ nombre, username, password, permisos: permisos ?? [], estado }, getUsuarioId(req));
        res.status(201).json(nuevo);
    }
    catch (e) {
        const status = e.message?.includes("duplicate") || e.message?.includes("ya existe") ? 409 : 500;
        res.status(status).json({ error: e.message ?? "Error al crear usuario" });
    }
});
// ── PATCH /api/usuarios/:id — actualizar ─────────────────────
// IMPORTANTE: esta ruta debe ir ANTES de /:id/desactivar y /:id/activar
exports.usuarioRouter.patch("/:id/desactivar", soloAdmin, async (req, res) => {
    try {
        const ok = await svc.desactivar(req.params["id"], getUsuarioId(req));
        if (!ok)
            return res.status(404).json({ error: "Usuario no encontrado" });
        res.json({ ok: true });
    }
    catch (e) {
        const status = e.message?.includes("ADMINISTRADOR") ? 403 : 500;
        res.status(status).json({ error: e.message ?? "Error" });
    }
});
exports.usuarioRouter.patch("/:id/activar", soloAdmin, async (req, res) => {
    try {
        const ok = await svc.activar(req.params["id"], getUsuarioId(req));
        if (!ok)
            return res.status(404).json({ error: "Usuario no encontrado" });
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message ?? "Error" });
    }
});
exports.usuarioRouter.patch("/:id", soloAdmin, async (req, res) => {
    try {
        const actualizado = await svc.actualizar(req.params["id"], req.body, getUsuarioId(req));
        if (!actualizado)
            return res.status(404).json({ error: "Usuario no encontrado" });
        res.json(actualizado);
    }
    catch (e) {
        const status = e.message?.includes("ADMINISTRADOR") ? 403 : 500;
        res.status(status).json({ error: e.message ?? "Error al actualizar" });
    }
});
//# sourceMappingURL=usuario.js.map