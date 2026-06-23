import { pool } from "../db/connection";
import bcrypt from "bcryptjs";
import type {
  UsuarioPublico,
  CrearUsuarioDTO,
  ActualizarUsuarioDTO,
  Modulo,
} from "../models/types";

const MODULOS_VALIDOS: Modulo[] = [
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

export class UsuarioService {

  // ── Listar solo usuarios ESTANDAR ──────────────────────────
  async listarEstandar(): Promise<UsuarioPublico[]> {
    const res = await pool.query(
      `${SELECT_PUBLICO} WHERE rol = 'ESTANDAR' ORDER BY nombre ASC`
    );
    return res.rows;
  }

  // ── Listar todos (administrador + estandar) ─────────────────
  async listarTodos(): Promise<UsuarioPublico[]> {
    const res = await pool.query(
      `${SELECT_PUBLICO} ORDER BY rol DESC, nombre ASC`
    );
    return res.rows;
  }

  // ── Obtener por ID ──────────────────────────────────────────
  async obtenerPorId(id: string): Promise<UsuarioPublico | null> {
    const res = await pool.query(
      `${SELECT_PUBLICO} WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  // ── Crear usuario ESTANDAR ──────────────────────────────────
  async crear(dto: CrearUsuarioDTO, creadoPor?: string): Promise<UsuarioPublico> {
    const permisosFiltrados = (dto.permisos ?? []).filter(
      (p) => MODULOS_VALIDOS.includes(p as Modulo)
    );
    const hash = await bcrypt.hash(dto.password, 10);

    // username = nombre en minúsculas sin espacios si no se provee
    const username = dto.username ?? dto.nombre.toLowerCase().replace(/\s+/g, ".");

    const res = await pool.query(
      `INSERT INTO usuarios
         (nombre, username, password, rol, estado, permisos, created_by)
       VALUES ($1, $2, $3, 'ESTANDAR', $4, $5, $6)
       RETURNING
         id, nombre, username, rol, estado, permisos,
         created_at AS fecha_crea,
         updated_at AS fecha_act`,
      [
        dto.nombre,
        username,
        hash,
        dto.estado ?? "ACTIVO",
        JSON.stringify(permisosFiltrados),
        creadoPor ?? null,
      ]
    );
    return res.rows[0];
  }

  // ── Actualizar usuario ESTANDAR ─────────────────────────────
  async actualizar(
    id: string,
    dto: ActualizarUsuarioDTO,
    actualizadoPor?: string
  ): Promise<UsuarioPublico | null> {
    const check = await pool.query(
      "SELECT rol FROM usuarios WHERE id = $1",
      [id]
    );
    if (!check.rows[0]) return null;
    if (check.rows[0].rol === "ADMINISTRADOR") {
      throw new Error("No se puede modificar un usuario ADMINISTRADOR desde este panel");
    }

    const sets: string[] = [];
    const vals: any[]    = [];
    let   idx            = 1;

    if (dto.nombre !== undefined) {
      sets.push(`nombre = $${idx++}`);
      vals.push(dto.nombre);
    }
    if (dto.estado !== undefined) {
      sets.push(`estado = $${idx++}`);
      vals.push(dto.estado);
    }
    if (dto.permisos !== undefined) {
      const limpios = dto.permisos.filter((p) =>
        MODULOS_VALIDOS.includes(p as Modulo)
      );
      sets.push(`permisos = $${idx++}`);
      vals.push(JSON.stringify(limpios));
    }
    if (dto.password && dto.password.trim() !== "") {
      const hash = await bcrypt.hash(dto.password, 10);
      sets.push(`password = $${idx++}`);
      vals.push(hash);
    }
    if (actualizadoPor) {
      sets.push(`updated_by = $${idx++}`);
      vals.push(actualizadoPor);
    }

    if (sets.length === 0) return this.obtenerPorId(id);

    vals.push(id);

    const res = await pool.query(
      `UPDATE usuarios
       SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING
         id, nombre, username, rol, estado, permisos,
         created_at AS fecha_crea,
         updated_at AS fecha_act`,
      vals
    );
    return res.rows[0] ?? null;
  }

  // ── Desactivar ──────────────────────────────────────────────
  async desactivar(id: string, actualizadoPor?: string): Promise<boolean> {
    const check = await pool.query(
      "SELECT rol FROM usuarios WHERE id = $1",
      [id]
    );
    if (!check.rows[0]) return false;
    if (check.rows[0].rol === "ADMINISTRADOR") {
      throw new Error("No se puede desactivar un usuario ADMINISTRADOR");
    }
    await pool.query(
      `UPDATE usuarios
       SET estado = 'INACTIVO', updated_by = $2
       WHERE id = $1`,
      [id, actualizadoPor ?? null]
    );
    return true;
  }

  // ── Activar ─────────────────────────────────────────────────
  async activar(id: string, actualizadoPor?: string): Promise<boolean> {
    const check = await pool.query(
      "SELECT rol FROM usuarios WHERE id = $1",
      [id]
    );
    if (!check.rows[0]) return false;
    await pool.query(
      `UPDATE usuarios
       SET estado = 'ACTIVO', updated_by = $2
       WHERE id = $1`,
      [id, actualizadoPor ?? null]
    );
    return true;
  }
}