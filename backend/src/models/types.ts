export type Modulo =
  | "clientes"
  | "prestamos"
  | "cxc"
  | "cobros"
  | "reportes"
  | "sucursales"   // ← nuevo
  | "usuarios";

export const MODULOS_VALIDOS: Modulo[] = [
  "clientes", "prestamos", "cxc", "cobros", "reportes", "sucursales",
  // "usuarios" NO se asigna a ESTANDAR — es solo para ADMINISTRADOR
];

export type RolUsuario    = "ADMINISTRADOR" | "ESTANDAR"; // ← igual que el enum de la BD
export type EstadoUsuario = "ACTIVO" | "INACTIVO" | "BLOQUEADO";

export interface UsuarioPublico {
  id:         string;
  nombre:     string;
  username:   string;
  rol:        RolUsuario;
  estado:     EstadoUsuario;
  permisos:   Modulo[];
  fecha_crea: string;
  fecha_act:  string;
}

export interface CrearUsuarioDTO {
  nombre:    string;
  username?: string;
  password:  string;
  permisos:  Modulo[];
  estado?:   EstadoUsuario;
}

export interface ActualizarUsuarioDTO {
  nombre?:   string;
  password?: string;
  estado?:   EstadoUsuario;
  permisos?: Modulo[];
}

// ── Sucursales ────────────────────────────────────────────────
// Contrato de API: estado siempre como string "ACTIVA" | "INACTIVA".
// La columna real en Postgres es boolean — SucursalService.ts hace
// la conversión internamente (estadoToBool / filaToSucursal).
// NO usar `boolean` aquí aunque la columna lo sea.

export type EstadoSucursalAPI = "ACTIVA" | "INACTIVA";

export interface Sucursal {
  id:          string;
  empresa_id:  string;
  nombre:      string;
  direccion:   string;
  telefono:    string | null;
  estado:      EstadoSucursalAPI;
  created_at:  string;
  updated_at:  string | null;
}

export interface NuevaSucursal {
  empresa_id:  string;
  nombre:      string;
  direccion:   string;
  telefono?:   string | null;
  estado?:     EstadoSucursalAPI;
}

export interface ActualizarSucursal {
  empresa_id?: string;
  nombre?: string;
  direccion?: string;
  telefono?: string | null;
  estado?: "ACTIVA" | "INACTIVA";
}