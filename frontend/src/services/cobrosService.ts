import { api } from "./api";
import type { Cobro, ResumenCobro } from "../types";

export const cobrosService = {
  listar: (): Promise<Cobro[]> =>
    api.get<Cobro[]>("/cobros"),

  obtenerPorId: (id: string): Promise<Cobro> =>
    api.get<Cobro>(`/cobros/${id}`),

  listarPorPrestamo: (prestamoId: string): Promise<Cobro[]> =>
    api.get<Cobro[]>(`/cobros/prestamo/${prestamoId}`),

  resumenPorPrestamo: (prestamoId: string): Promise<ResumenCobro> =>
    api.get<ResumenCobro>(`/cobros/prestamo/${prestamoId}/resumen`),

  registrar: (prestamoId: string, montoPagado: number): Promise<Cobro> =>
    api.post<Cobro>("/cobros", { prestamoId, montoPagado }),

  cambiarEstado: (
    id: string,
    estado: "PENDIENTE" | "PAGADO" | "PARCIAL" | "ATRASADO"
  ): Promise<Cobro> =>
    api.patch<Cobro>(`/cobros/${id}/estado`, { estado }),
};