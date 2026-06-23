import { api } from "./api";
import type {
  Usuario,
  LoginDTO,
  RegistroDTO,
  LoginResponse,
} from "../types";

export const usuariosService = {
  registro: (datos: RegistroDTO): Promise<{ message: string; usuario: Usuario }> =>
    api.post("/usuarios/registro", datos),

  login: (datos: LoginDTO): Promise<LoginResponse> =>
    api.post<LoginResponse>("/usuarios/login", datos),

  listar: (): Promise<Usuario[]> =>
    api.get<Usuario[]>("/usuarios"),

  perfil: (): Promise<Usuario> =>
    api.get<Usuario>("/usuarios/perfil"),

  eliminar: (id: string): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/usuarios/${id}`),
};
