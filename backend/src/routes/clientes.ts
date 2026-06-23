import { Router } from "express";
import type { Request, Response } from "express";
import { ClienteService } from "../services/ClienteService";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const svc = new ClienteService();

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  try {
    res.json(await svc.listarClientes());
  } catch {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const cliente = await svc.obtenerClientePorId(id);
    if (!cliente) { res.status(404).json({ error: "Cliente no encontrado" }); return; }
    res.json(cliente);
  } catch {
    res.status(500).json({ error: "Error al obtener cliente" });
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nombres, apellidos, documento_identidad, tipo_documento,
            email, score, telefono } = req.body;

    if (!nombres || !apellidos || !documento_identidad) {
      res.status(400).json({ error: "nombres, apellidos y documento_identidad son requeridos" });
      return;
    }
    if (score != null && (!Number.isInteger(score) || score < 300 || score > 850)) {
      res.status(400).json({ error: "El score debe ser un entero entre 300 y 850" });
      return;
    }

    const cliente = await svc.crearCliente(
      nombres, apellidos, documento_identidad,
      tipo_documento ?? "CEDULA", email, score, telefono
    );
    res.status(201).json(cliente);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error &&
        (error as { code: string }).code === "23505") {
      res.status(409).json({ error: "El documento de identidad ya está registrado" });
      return;
    }
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const { nombres, apellidos, email, score, telefono } = req.body;

    if (!nombres && !apellidos && !email && score == null && !telefono) {
      res.status(400).json({ error: "Debes enviar al menos un campo para actualizar" });
      return;
    }
    if (score != null && (!Number.isInteger(score) || score < 300 || score > 850)) {
      res.status(400).json({ error: "El score debe ser un entero entre 300 y 850" });
      return;
    }

    const cliente = await svc.actualizarCliente(id, { nombres, apellidos, email, score, telefono });
    if (!cliente) { res.status(404).json({ error: "Cliente no encontrado" }); return; }
    res.json(cliente);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error &&
        (error as { code: string }).code === "23505") {
      res.status(409).json({ error: "El email ya está registrado" });
      return;
    }
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const inactivado = await svc.inactivarCliente(id);
    if (!inactivado) { res.status(404).json({ error: "Cliente no encontrado" }); return; }
    res.json({ message: "Cliente inactivado correctamente" });
  } catch {
    res.status(500).json({ error: "Error al inactivar cliente" });
  }
});

export default router;