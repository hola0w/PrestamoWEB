// src/routes/Sucursales.ts
import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware, JwtPayload } from "../middleware/auth";
import { SucursalService, ErrorValidacion } from "../services/SucursalService";

const router = Router();

router.use(authMiddleware);

// ── Acceso de escritura: ADMIN siempre, o ESTANDAR con permiso "sucursales" ──
function requireAccesoSucursales(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JwtPayload;
  const puedeEscribir = user.rol === "ADMINISTRADOR" || user.permisos?.includes("sucursales");
  if (!puedeEscribir) {
    return res.status(403).json({ error: "No tienes permiso para gestionar sucursales" });
  }
  next();
}

// ── Helper: traduce errores conocidos a respuestas claras ──
function manejarError(err: any, res: Response, accion: string) {
  if (err instanceof ErrorValidacion) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === "23503") {
    return res.status(400).json({ error: "La empresa indicada no existe." });
  }
  if (err.code === "23505") {
    return res.status(409).json({ error: "Ya existe una sucursal con ese nombre en esta empresa." });
  }
  console.error(`Error al ${accion} sucursal:`, err);
  res.status(500).json({ error: `Error al ${accion} la sucursal` });
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JwtPayload & { empresaId?: string };
    const sucursales = await SucursalService.listar(user.empresaId ?? null);
    res.json(sucursales);
  } catch (err) {
    manejarError(err, res, "obtener");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const sucursal = await SucursalService.obtenerPorId(id);
    if (!sucursal) return res.status(404).json({ error: "Sucursal no encontrada" });
    res.json(sucursal);
  } catch (err) {
    manejarError(err, res, "obtener");
  }
});

router.post("/", requireAccesoSucursales, async (req: Request, res: Response) => {
  try {
    const { nombre, direccion, telefono, estado, empresa_id } = req.body;
    const user = (req as any).user as JwtPayload & { empresaId?: string };

    if (!nombre?.trim())    return res.status(400).json({ error: "El nombre de la sucursal es obligatorio." });
    if (!direccion?.trim()) return res.status(400).json({ error: "La dirección es obligatoria." });

    const empresaFinal = empresa_id ?? user.empresaId;
    if (!empresaFinal) {
      return res.status(400).json({ error: "Debe especificar empresa_id para la sucursal." });
    }

    const nueva = await SucursalService.crear({
      empresa_id: empresaFinal,
      nombre,
      direccion,
      telefono,
      estado,
    });
    res.status(201).json(nueva);
  } catch (err) {
    manejarError(err, res, "crear");
  }
});

router.patch("/:id", requireAccesoSucursales, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const actual = await SucursalService.obtenerPorId(id);
    if (!actual) return res.status(404).json({ error: "Sucursal no encontrada" });

    const actualizada = await SucursalService.actualizar(id, req.body);
    res.json(actualizada);
  } catch (err) {
    manejarError(err, res, "actualizar");
  }
});

router.delete("/:id", requireAccesoSucursales, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const actual = await SucursalService.obtenerPorId(id);
    if (!actual) return res.status(404).json({ error: "Sucursal no encontrada" });

    await SucursalService.eliminar(id);
    res.status(204).send();
  } catch (err) {
    manejarError(err, res, "eliminar");
  }
});

export default router;