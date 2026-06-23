import { api } from "./api";
import type { Sucursal, CrearSucursalDTO, ActualizarSucursalDTO } from "../types";

export const sucursalesService = {
  listar: (): Promise<Sucursal[]> =>
    api.get<Sucursal[]>("/sucursales"),

  obtenerPorId: (id: string): Promise<Sucursal> =>
    api.get<Sucursal>(`/sucursales/${id}`),

  crear: (datos: CrearSucursalDTO): Promise<Sucursal> =>
    api.post<Sucursal>("/sucursales", {
      nombre:     datos.nombre,
      direccion:  datos.direccion,
      telefono:   datos.telefono ?? null,
      estado:     datos.estado ?? "ACTIVA",
      empresa_id: datos.empresa_id,
    }),

  actualizar: (id: string, datos: ActualizarSucursalDTO): Promise<Sucursal> =>
    api.patch<Sucursal>(`/sucursales/${id}`, datos),

  eliminar: (id: string): Promise<void> =>
    api.delete<void>(`/sucursales/${id}`),
};