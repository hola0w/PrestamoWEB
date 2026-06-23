"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClienteService = void 0;
const connection_1 = require("../db/connection");
class ClienteService {
    async crearCliente(nombres, apellidos, documento_identidad, tipo_documento = "CEDULA", email, score, telefono) {
        const res = await connection_1.pool.query(`INSERT INTO clientes
         (nombres, apellidos, documento_identidad, tipo_documento,
          foto_documento_frontal, email, score, estado)
       VALUES ($1, $2, $3, $4, '', $5, $6, 'ACTIVO')
       RETURNING id, nombres, apellidos, documento_identidad,
                 tipo_documento, email, score, estado, created_at`, [nombres, apellidos, documento_identidad, tipo_documento,
            email ?? null, score ?? null]);
        const cliente = res.rows[0];
        if (telefono) {
            await connection_1.pool.query(`INSERT INTO telefonos_clientes (cliente_id, telefono, tipo, principal)
         VALUES ($1, $2, 'CELULAR', true)`, [cliente.id, telefono]);
        }
        return cliente;
    }
    async listarClientes() {
        const res = await connection_1.pool.query(`
      SELECT
        c.id, c.nombres, c.apellidos, c.documento_identidad,
        c.tipo_documento, c.email, c.score, c.estado, c.created_at,
        CONCAT(c.nombres, ' ', c.apellidos) AS nombre,
        (SELECT t.telefono FROM telefonos_clientes t
         WHERE t.cliente_id = c.id AND t.principal = true LIMIT 1
        ) AS telefono_principal
      FROM clientes c
      WHERE c.estado = 'ACTIVO'
      ORDER BY c.nombres ASC
    `);
        return res.rows;
    }
    async obtenerClientePorId(id) {
        const res = await connection_1.pool.query(`
      SELECT
        c.*,
        CONCAT(c.nombres, ' ', c.apellidos) AS nombre,
        (SELECT t.telefono FROM telefonos_clientes t
         WHERE t.cliente_id = c.id AND t.principal = true LIMIT 1
        ) AS telefono_principal
      FROM clientes c
      WHERE c.id = $1
    `, [id]);
        return res.rows[0] ?? null;
    }
    async actualizarCliente(id, datos) {
        const campos = [];
        const valores = [];
        let i = 1;
        if (datos.nombres) {
            campos.push(`nombres = $${i++}`);
            valores.push(datos.nombres);
        }
        if (datos.apellidos) {
            campos.push(`apellidos = $${i++}`);
            valores.push(datos.apellidos);
        }
        if (datos.email) {
            campos.push(`email = $${i++}`);
            valores.push(datos.email);
        }
        if (datos.score != null) {
            campos.push(`score = $${i++}`);
            valores.push(datos.score);
        }
        if (campos.length > 0) {
            valores.push(id);
            await connection_1.pool.query(`UPDATE clientes SET ${campos.join(", ")} WHERE id = $${i}`, valores);
        }
        if (datos.telefono) {
            await connection_1.pool.query(`INSERT INTO telefonos_clientes (cliente_id, telefono, tipo, principal)
         VALUES ($1, $2, 'CELULAR', true)
         ON CONFLICT DO NOTHING`, [id, datos.telefono]);
        }
        return this.obtenerClientePorId(id);
    }
    async inactivarCliente(id) {
        const res = await connection_1.pool.query(`UPDATE clientes SET estado = 'INACTIVO'
       WHERE id = $1 AND estado = 'ACTIVO'
       RETURNING id, nombres, apellidos, estado`, [id]);
        return res.rows[0] ?? null;
    }
}
exports.ClienteService = ClienteService;
//# sourceMappingURL=ClienteService.js.map