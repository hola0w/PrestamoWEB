import { Router, Request, Response, NextFunction } from "express";
import { UsuarioService } from "../services/UsuarioService";

export const usuarioRouter = Router();
const svc = new UsuarioService();

// ── Middleware: solo ADMINISTRADOR ────────────────────────────
function soloAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.rol !== "ADMINISTRADOR") {
    return res.status(403).json({ error: "Acceso denegado. Se requiere rol ADMINISTRADOR." });
  }
  next();
}

// Helper para extraer usuarioId del JWT
function getUsuarioId(req: Request): string {
  return (req as any).user?.id as string;
}

// ── GET /api/usuarios — lista ESTANDAR ───────────────────────
usuarioRouter.get("/", soloAdmin, async (_req, res) => {
  try {
    res.json(await svc.listarEstandar());
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Error al listar usuarios" });
  }
});

// ── GET /api/usuarios/todos — lista todos ────────────────────
usuarioRouter.get("/todos", soloAdmin, async (_req, res) => {
  try {
    res.json(await svc.listarTodos());
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Error" });
  }
});

// ── GET /api/usuarios/:id ─────────────────────────────────────
usuarioRouter.get("/:id", soloAdmin, async (req, res) => {
  try {
    const u = await svc.obtenerPorId(req.params["id"] as string);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(u);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Error" });
  }
});

// ── POST /api/usuarios — crear ESTANDAR ──────────────────────
usuarioRouter.post("/", soloAdmin, async (req, res) => {
  const { nombre, username, password, permisos, estado } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ error: "nombre y password son requeridos" });
  }
  try {
    const nuevo = await svc.crear(
      { nombre, username, password, permisos: permisos ?? [], estado },
      getUsuarioId(req)
    );
    res.status(201).json(nuevo);
  } catch (e: any) {
    const status = e.message?.includes("duplicate") || e.message?.includes("ya existe") ? 409 : 500;
    res.status(status).json({ error: e.message ?? "Error al crear usuario" });
  }
});

// ── PATCH /api/usuarios/:id — actualizar ─────────────────────
// IMPORTANTE: esta ruta debe ir ANTES de /:id/desactivar y /:id/activar
usuarioRouter.patch("/:id/desactivar", soloAdmin, async (req, res) => {
  try {
    const ok = await svc.desactivar(req.params["id"] as string, getUsuarioId(req));
    if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (e: any) {
    const status = e.message?.includes("ADMINISTRADOR") ? 403 : 500;
    res.status(status).json({ error: e.message ?? "Error" });
  }
});

usuarioRouter.patch("/:id/activar", soloAdmin, async (req, res) => {
  try {
    const ok = await svc.activar(req.params["id"] as string, getUsuarioId(req));
    if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Error" });
  }
});

usuarioRouter.patch("/:id", soloAdmin, async (req, res) => {
  try {
    const actualizado = await svc.actualizar(
      req.params["id"] as string,
      req.body,
      getUsuarioId(req)
    );
    if (!actualizado) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(actualizado);
  } catch (e: any) {
    const status = e.message?.includes("ADMINISTRADOR") ? 403 : 500;
    res.status(status).json({ error: e.message ?? "Error al actualizar" });
  }
});