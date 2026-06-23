type EstadoCobro = "PENDIENTE" | "PAGADO" | "PARCIAL" | "ATRASADO";
export declare class CobrosService {
    registrarCobro(prestamoId: string, montoPagado: number, usuarioId: string): Promise<any>;
    listarCobros(): Promise<any[]>;
    listarPorPrestamo(prestamoId: string): Promise<any[]>;
    obtenerPorId(id: string): Promise<any>;
    cambiarEstado(id: string, estado: EstadoCobro, usuarioId: string): Promise<any>;
    resumenPorPrestamo(prestamoId: string): Promise<any>;
}
export {};
