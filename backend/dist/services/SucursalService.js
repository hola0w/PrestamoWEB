"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SucursalService = exports.ErrorValidacion = void 0;
// src/services/SucursalService.ts
//
// ⚠️ Ajusta el import a como exportes el pool en connection.ts real.
const connection_1 = require("../db/connection");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class ErrorValidacion extends Error {
    constructor(message) {
        super(message);
        this.name = "ErrorValidacion";
    }
}
exports.ErrorValidacion = ErrorValidacion;
// ── Conversión estado (API: "ACTIVA"/"INACTIVA") <-> boolean (columna real en BD) ──
function estadoToBool(estado) {
    return estado !== "INACTIVA"; // default true / ACTIVA si no se especifica
}
// ⚠️ Esta función convierte el boolean de la BD a string para el frontend.
// Si no se aplica en listar()/obtenerPorId(), el frontend recibe true/false crudo.
function filaToSucursal(row) {
    return {
        ...row,
        estado: row.estado ? "ACTIVA" : "INACTIVA",
    };
}
class SucursalService {
    static async listar(empresaId) {
        if (empresaId) {
            const { rows } = await connection_1.pool.query(`SELECT id, empresa_id, nombre, direccion, telefono, estado, created_at, updated_at
         FROM sucursales
         WHERE empresa_id = $1
         ORDER BY created_at DESC`, [empresaId]);
            return rows.map(filaToSucursal);
        }
        const { rows } = await connection_1.pool.query(`SELECT id, empresa_id, nombre, direccion, telefono, estado, created_at, updated_at
       FROM sucursales
       ORDER BY created_at DESC`);
        return rows.map(filaToSucursal);
    }
    static async obtenerPorId(id) {
        const { rows } = await connection_1.pool.query(`SELECT id, empresa_id, nombre, direccion, telefono, estado, created_at, updated_at
       FROM sucursales WHERE id = $1`, [id]);
        return rows[0] ? filaToSucursal(rows[0]) : null;
    }
    static async crear(data) {
        const { empresa_id, nombre, direccion, telefono, estado } = data;
        if (!empresa_id || !UUID_REGEX.test(empresa_id)) {
            throw new ErrorValidacion("empresa_id inválido o ausente.");
        }
        if (!nombre?.trim()) {
            throw new ErrorValidacion("El nombre de la sucursal es obligatorio.");
        }
        if (!direccion?.trim()) {
            throw new ErrorValidacion("La dirección es obligatoria.");
        }
        console.log("📦 SucursalService.crear() recibió:", { empresa_id, nombre, direccion, telefono, estado });
        const { rows } = await connection_1.pool.query(`INSERT INTO sucursales (empresa_id, nombre, direccion, telefono, estado)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, empresa_id, nombre, direccion, telefono, estado, created_at, updated_at`, [empresa_id, nombre.trim(), direccion.trim(), telefono ?? null, estadoToBool(estado)]);
        return filaToSucursal(rows[0]);
    }
    static async actualizar(id, data) {
        if (data.empresa_id !== undefined && !UUID_REGEX.test(data.empresa_id)) {
            throw new ErrorValidacion("empresa_id inválido.");
        }
        const campos = [];
        const valores = [];
        let i = 1;
        if (data.empresa_id !== undefined) {
            campos.push(`empresa_id = $${i++}`);
            valores.push(data.empresa_id);
        }
        if (data.nombre !== undefined) {
            campos.push(`nombre = $${i++}`);
            valores.push(data.nombre.trim());
        }
        if (data.direccion !== undefined) {
            campos.push(`direccion = $${i++}`);
            valores.push(data.direccion.trim());
        }
        if (data.telefono !== undefined) {
            campos.push(`telefono = $${i++}`);
            valores.push(data.telefono ?? null);
        }
        if (data.estado !== undefined) {
            campos.push(`estado = $${i++}`);
            valores.push(estadoToBool(data.estado));
        }
        if (campos.length === 0)
            return this.obtenerPorId(id);
        valores.push(id);
        const { rows } = await connection_1.pool.query(`UPDATE sucursales SET ${campos.join(", ")}
       WHERE id = $${i}
       RETURNING id, empresa_id, nombre, direccion, telefono, estado, created_at, updated_at`, valores);
        return rows[0] ? filaToSucursal(rows[0]) : null;
    }
    static async eliminar(id) {
        const { rowCount } = await connection_1.pool.query(`DELETE FROM sucursales WHERE id = $1`, [id]);
        return (rowCount ?? 0) > 0;
    }
}
exports.SucursalService = SucursalService;
//# sourceMappingURL=SucursalService.js.map