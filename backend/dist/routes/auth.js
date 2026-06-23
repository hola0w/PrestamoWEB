"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authRouter = (0, express_1.Router)();
const SECRET = process.env.JWT_SECRET || "tu_secreto_aqui";
authRouter.post("/login", async (req, res) => {
    // Guard: si express.json() no está configurado, req.body llega undefined
    if (!req.body) {
        return res.status(400).json({ error: "Body vacío. Verifica que el servidor tenga express.json() configurado." });
    }
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "username y password son requeridos" });
    }
    try {
        // FIX: se agrega empresa_id y, vía JOIN, el nombre de la empresa.
        // LEFT JOIN porque empresa_id puede ser NULL (usuario aún sin asignar).
        const result = await connection_1.pool.query(`SELECT
         u.id, u.nombre, u.username, u.password, u.rol, u.permisos, u.estado,
         u.empresa_id,
         e.nombre AS empresa_nombre
       FROM usuarios u
       LEFT JOIN empresas e ON e.id = u.empresa_id
       WHERE u.username = $1`, [username]);
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
        const ok = await bcryptjs_1.default.compare(password, usuario.password);
        if (!ok) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }
        const token = jsonwebtoken_1.default.sign({
            id: usuario.id,
            nombre: usuario.nombre,
            username: usuario.username,
            rol: usuario.rol,
            permisos: usuario.permisos ?? [],
            empresaId: usuario.empresa_id ?? null,
            empresaNombre: usuario.empresa_nombre ?? null,
        }, SECRET, { expiresIn: "8h" });
        return res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                username: usuario.username,
                rol: usuario.rol,
                estado: usuario.estado,
                permisos: usuario.permisos ?? [],
                empresaId: usuario.empresa_id ?? null,
                empresaNombre: usuario.empresa_nombre ?? null,
            },
        });
    }
    catch (e) {
        console.error("LOGIN ERROR:", e);
        return res.status(500).json({ error: e.message ?? "Error interno" });
    }
});
exports.default = authRouter;
//# sourceMappingURL=auth.js.map