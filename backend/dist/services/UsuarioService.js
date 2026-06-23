"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsuarioService = void 0;
const connection_1 = require("../db/connection");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const MODULOS_VALIDOS = [
    "clientes", "prestamos", "cxc", "cobros", "reportes",
];
// Columnas reales de la BD
const SELECT_PUBLICO = `
  SELECT
    id,
    nombre,
    username,
    rol,
    estado,
    permisos,
    created_at  AS fecha_crea,
    updated_at  AS fecha_act
  FROM usuarios
`;
class UsuarioService {
    // ── Listar solo usuarios ESTANDAR ──────────────────────────
    async listarEstandar() {
        const res = await connection_1.pool.query(`${SELECT_PUBLICO} WHERE rol = 'ESTANDAR' ORDER BY nombre ASC`);
        return res.rows;
    }
    // ── Listar todos (administrador + estandar) ─────────────────
    async listarTodos() {
        const res = await connection_1.pool.query(`${SELECT_PUBLICO} ORDER BY rol DESC, nombre ASC`);
        return res.rows;
    }
    // ── Obtener por ID ──────────────────────────────────────────
    async obtenerPorId(id) {
        const res = await connection_1.pool.query(`${SELECT_PUBLICO} WHERE id = $1`, [id]);
        return res.rows[0] ?? null;
    }
    // ── Crear usuario ESTANDAR ──────────────────────────────────
    async crear(dto, creadoPor) {
        const permisosFiltrados = (dto.permisos ?? []).filter((p) => MODULOS_VALIDOS.includes(p));
        const hash = await bcryptjs_1.default.hash(dto.password, 10);
        // username = nombre en minúsculas sin espacios si no se provee
        const username = dto.username ?? dto.nombre.toLowerCase().replace(/\s+/g, ".");
        const res = await connection_1.pool.query(`INSERT INTO usuarios
         (nombre, username, password, rol, estado, permisos, created_by)
       VALUES ($1, $2, $3, 'ESTANDAR', $4, $5, $6)
       RETURNING
         id, nombre, username, rol, estado, permisos,
         created_at AS fecha_crea,
         updated_at AS fecha_act`, [
            dto.nombre,
            username,
            hash,
            dto.estado ?? "ACTIVO",
            JSON.stringify(permisosFiltrados),
            creadoPor ?? null,
        ]);
        return res.rows[0];
    }
    // ── Actualizar usuario ESTANDAR ─────────────────────────────
    async actualizar(id, dto, actualizadoPor) {
        const check = await connection_1.pool.query("SELECT rol FROM usuarios WHERE id = $1", [id]);
        if (!check.rows[0])
            return null;
        if (check.rows[0].rol === "ADMINISTRADOR") {
            throw new Error("No se puede modificar un usuario ADMINISTRADOR desde este panel");
        }
        const sets = [];
        const vals = [];
        let idx = 1;
        if (dto.nombre !== undefined) {
            sets.push(`nombre = $${idx++}`);
            vals.push(dto.nombre);
        }
        if (dto.estado !== undefined) {
            sets.push(`estado = $${idx++}`);
            vals.push(dto.estado);
        }
        if (dto.permisos !== undefined) {
            const limpios = dto.permisos.filter((p) => MODULOS_VALIDOS.includes(p));
            sets.push(`permisos = $${idx++}`);
            vals.push(JSON.stringify(limpios));
        }
        if (dto.password && dto.password.trim() !== "") {
            const hash = await bcryptjs_1.default.hash(dto.password, 10);
            sets.push(`password = $${idx++}`);
            vals.push(hash);
        }
        if (actualizadoPor) {
            sets.push(`updated_by = $${idx++}`);
            vals.push(actualizadoPor);
        }
        if (sets.length === 0)
            return this.obtenerPorId(id);
        vals.push(id);
        const res = await connection_1.pool.query(`UPDATE usuarios
       SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING
         id, nombre, username, rol, estado, permisos,
         created_at AS fecha_crea,
         updated_at AS fecha_act`, vals);
        return res.rows[0] ?? null;
    }
    // ── Desactivar ──────────────────────────────────────────────
    async desactivar(id, actualizadoPor) {
        const check = await connection_1.pool.query("SELECT rol FROM usuarios WHERE id = $1", [id]);
        if (!check.rows[0])
            return false;
        if (check.rows[0].rol === "ADMINISTRADOR") {
            throw new Error("No se puede desactivar un usuario ADMINISTRADOR");
        }
        await connection_1.pool.query(`UPDATE usuarios
       SET estado = 'INACTIVO', updated_by = $2
       WHERE id = $1`, [id, actualizadoPor ?? null]);
        return true;
    }
    // ── Activar ─────────────────────────────────────────────────
    async activar(id, actualizadoPor) {
        const check = await connection_1.pool.query("SELECT rol FROM usuarios WHERE id = $1", [id]);
        if (!check.rows[0])
            return false;
        await connection_1.pool.query(`UPDATE usuarios
       SET estado = 'ACTIVO', updated_by = $2
       WHERE id = $1`, [id, actualizadoPor ?? null]);
        return true;
    }
}
exports.UsuarioService = UsuarioService;
//# sourceMappingURL=UsuarioService.js.map