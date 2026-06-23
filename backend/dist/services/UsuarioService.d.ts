import type { UsuarioPublico, CrearUsuarioDTO, ActualizarUsuarioDTO } from "../models/types";
export declare class UsuarioService {
    listarEstandar(): Promise<UsuarioPublico[]>;
    listarTodos(): Promise<UsuarioPublico[]>;
    obtenerPorId(id: string): Promise<UsuarioPublico | null>;
    crear(dto: CrearUsuarioDTO, creadoPor?: string): Promise<UsuarioPublico>;
    actualizar(id: string, dto: ActualizarUsuarioDTO, actualizadoPor?: string): Promise<UsuarioPublico | null>;
    desactivar(id: string, actualizadoPor?: string): Promise<boolean>;
    activar(id: string, actualizadoPor?: string): Promise<boolean>;
}
