import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { pool } from "../db/connection";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET || "tu_secreto_aqui";

// Actualizamos los roles válidos según tu ENUM de PostgreSQL
export interface JwtPayload {
  id:             string;
  nombre:         string;
  username:       string;
  rol:            "ADMINISTRADOR" | "SUPERVISOR" | "COBRADOR" | "OPERADOR";
  permisos:       string[];
  empresaId:      string | null;
  empresaNombre:  string | null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ error: "Body vacío. Verifica que el servidor tenga express.json() configurado." });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username y password son requeridos" });
  }

  try {
   // -- CORREGIDO: Se remueve u.permisos de la consulta SQL para evitar el error de columna inexistente
    const result = await pool.query(
      `SELECT
         u.id, u.nombre, u.username, u.password, u.rol, u.estado,
         u.empresa_id,
         e.nombre AS empresa_nombre
       FROM usuarios u
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE u.username = $1`,
      [username]
    );

    const usuario = result.rows[0];

    if (!usuario) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    if (usuario.estado === "INACTIVO") {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    if (usuario.estado === "BLOQUEADO") {
      return res.status(403).json({ error: "Usuario bloqueado" });
    }

    const ok = await bcrypt.compare(password, usuario.password);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

   // -- Mapeo dinámico de permisos basado en el rol para no romper tu Frontend
    const permisosSimulados = usuario.rol === "ADMINISTRADOR" 
      ? ["all"] 
      : ["leer", "crear_prestamos"];

    const tokenPayload: JwtPayload = {
      id:             usuario.id,
      nombre:         usuario.nombre,
      username:       usuario.username,
      rol:            usuario.rol,
      permisos:       permisosSimulados,
      empresaId:      usuario.empresa_id ?? null,
      empresaNombre:  usuario.empresa_nombre ?? null,
    };

    const token = jwt.sign(tokenPayload, SECRET, { expiresIn: "8h" });

    return res.json({
      token,
      usuario: {
        id:             usuario.id,
        nombre:         usuario.nombre,
        username:       usuario.username,
        rol:            usuario.rol,
        estado:         usuario.estado,
        permisos:       permisosSimulados,
        empresaId:      usuario.empresa_id ?? null,
        empresaNombre:  usuario.empresa_nombre ?? null,
      },
    });
  } catch (e: any) {
    console.error("LOGIN ERROR:", e);
    return res.status(500).json({ error: e.message ?? "Error interno" });
  }
});

export default authRouter;