import type { Sucursal, NuevaSucursal, ActualizarSucursal } from "../models/types";
export declare class ErrorValidacion extends Error {
    constructor(message: string);
}
export declare class SucursalService {
    static listar(empresaId?: string | null): Promise<Sucursal[]>;
    static obtenerPorId(id: string): Promise<Sucursal | null>;
    static crear(data: NuevaSucursal): Promise<Sucursal>;
    static actualizar(id: string, data: ActualizarSucursal): Promise<Sucursal | null>;
    static eliminar(id: string): Promise<boolean>;
}
