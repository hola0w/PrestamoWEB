export type Modulo = "clientes" | "prestamos" | "cxc" | "cobros" | "reportes" | "sucursales" | "usuarios";
export declare const MODULOS_VALIDOS: Modulo[];
export type RolUsuario = "ADMINISTRADOR" | "ESTANDAR";
export type EstadoUsuario = "ACTIVO" | "INACTIVO" | "BLOQUEADO";
export interface UsuarioPublico {
    id: string;
    nombre: string;
    username: string;
    rol: RolUsuario;
    estado: EstadoUsuario;
    permisos: Modulo[];
    fecha_crea: string;
    fecha_act: string;
}
export interface CrearUsuarioDTO {
    nombre: string;
    username?: string;
    password: string;
    permisos: Modulo[];
    estado?: EstadoUsuario;
}
export interface ActualizarUsuarioDTO {
    nombre?: string;
    password?: string;
    estado?: EstadoUsuario;
    permisos?: Modulo[];
}
export type EstadoSucursalAPI = "ACTIVA" | "INACTIVA";
export interface Sucursal {
    id: string;
    empresa_id: string;
    nombre: string;
    direccion: string;
    telefono: string | null;
    estado: EstadoSucursalAPI;
    created_at: string;
    updated_at: string | null;
}
export interface NuevaSucursal {
    empresa_id: string;
    nombre: string;
    direccion: string;
    telefono?: string | null;
    estado?: EstadoSucursalAPI;
}
export interface ActualizarSucursal {
    empresa_id?: string;
    nombre?: string;
    direccion?: string;
    telefono?: string | null;
    estado?: "ACTIVA" | "INACTIVA";
}
