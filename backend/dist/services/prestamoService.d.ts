type EstadoPrestamo = "PENDIENTE" | "APROBADO" | "ACTIVO" | "PAGADO" | "MOROSO" | "CANCELADO";
export declare class PrestamoService {
    calcularCuota(capital: number, tasaAnual: number, plazoMeses: number, tipoPlazo?: string): number;
    crearPrestamo(clienteId: string, capital: number, tasaAnual: number, plazoMeses: number, tipoPlazo: string | undefined, usuarioId: string, observacion?: string): Promise<any>;
    listarPrestamos(): Promise<any[]>;
    obtenerPorId(id: string): Promise<any>;
    listarPorCliente(clienteId: string): Promise<any[]>;
    cambiarEstado(prestamoId: string, estado: EstadoPrestamo, usuarioId: string): Promise<any>;
}
export {};
