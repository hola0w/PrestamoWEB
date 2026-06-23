import { api } from "./api";
import type { Cliente, CrearClienteDTO, ActualizarClienteDTO } from "../types";

export const clientesService = {
  listar: (): Promise<Cliente[]> =>
    api.get<Cliente[]>("/clientes"),

  obtenerPorId: (id: string): Promise<Cliente> =>
    api.get<Cliente>(`/clientes/${id}`),

  crear: (datos: CrearClienteDTO): Promise<Cliente> =>
    api.post<Cliente>("/clientes", datos),

  actualizar: (id: string, datos: ActualizarClienteDTO): Promise<Cliente> =>
    api.patch<Cliente>(`/clientes/${id}`, datos),

  eliminar: (id: string): Promise<{ message: string }> =>
    api.delete<{ message: string }>(`/clientes/${id}`),
};