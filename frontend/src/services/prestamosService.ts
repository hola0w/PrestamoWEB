import { api } from "./api";
import type { Prestamo, CrearPrestamoDTO, EstadoPrestamo } from "../types";

export const prestamosService = {
  listar: (): Promise<Prestamo[]> =>
    api.get<Prestamo[]>("/prestamos"),

  obtenerPorId: (id: string): Promise<Prestamo> =>
    api.get<Prestamo>(`/prestamos/${id}`),

  listarPorCliente: (clienteId: string): Promise<Prestamo[]> =>
    api.get<Prestamo[]>(`/prestamos/cliente/${clienteId}`),

  crear: (datos: CrearPrestamoDTO): Promise<Prestamo> =>
    api.post<Prestamo>("/prestamos", {
      clienteId:   datos.clienteId,
      capital:     datos.capital,
      tasaAnual:   datos.tasaAnual,
      plazoMeses:  datos.plazoMeses,
      tipoPlazo:   datos.tipoPlazo,
      observacion: datos.observacion,
    }),

  cambiarEstado: (id: string, estado: EstadoPrestamo): Promise<Prestamo> =>
    api.patch<Prestamo>(`/prestamos/${id}/estado`, { estado }),
};