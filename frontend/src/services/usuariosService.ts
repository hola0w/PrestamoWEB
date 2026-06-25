import { api } from "./api";
import type {
  Usuario,
  LoginDTO,
  RegistroDTO,
  LoginResponse,
} from "../types";
import type { Modulo } from "../hooks/useAuth";

// ── Tipos del panel admin ──────────────────────────────────────
export interface UsuarioAdmin {
  id:         string;
  nombre:     string;
  username:   string;
  rol:        "ADMINISTRADOR" | "ESTANDAR";
  estado:     "ACTIVO" | "INACTIVO";
  permisos:   Modulo[];
  fecha_crea: string;
  fecha_act:  string;
}

export interface CrearUsuarioDTO {
  nombre:   string;
  username: string;
  password: string;
  permisos: Modulo[];
  estado?:  "ACTIVO" | "INACTIVO";
}

export interface ActualizarUsuarioDTO {
  nombre?:   string;
  estado?:   "ACTIVO" | "INACTIVO";
  permisos?: Modulo[];
  password?: string;
}

export const usuariosService = {
  // ── Auth ──────────────────────────────────────────────────────
  registro: (datos: RegistroDTO): Promise<{ message: string; usuario: Usuario }> =>
    api.post("/usuarios/registro", datos),

  login: (datos: LoginDTO): Promise<LoginResponse> =>
    api.post<LoginResponse>("/usuarios/login", datos),

  perfil: (): Promise<Usuario> =>
    api.get<Usuario>("/usuarios/perfil"),

  eliminar: (id: string): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/usuarios/${id}`),

  // ── Panel admin ───────────────────────────────────────────────
  listar: (): Promise<UsuarioAdmin[]> =>
    api.get<UsuarioAdmin[]>("/usuarios"),

  listarTodos: (): Promise<UsuarioAdmin[]> =>
    api.get<UsuarioAdmin[]>("/usuarios/todos"),

  obtenerPorId: (id: string): Promise<UsuarioAdmin> =>
    api.get<UsuarioAdmin>(`/usuarios/${id}`),

  crear: (datos: CrearUsuarioDTO): Promise<UsuarioAdmin> =>
    api.post<UsuarioAdmin>("/usuarios", datos),

  actualizar: (id: string, datos: ActualizarUsuarioDTO): Promise<UsuarioAdmin> =>
    api.patch<UsuarioAdmin>(`/usuarios/${id}`, datos),

  desactivar: (id: string): Promise<{ ok: boolean }> =>
    api.patch<{ ok: boolean }>(`/usuarios/${id}/desactivar`, {}),

  activar: (id: string): Promise<{ ok: boolean }> =>
    api.patch<{ ok: boolean }>(`/usuarios/${id}/activar`, {}),
};