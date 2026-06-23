export declare class ClienteService {
    crearCliente(nombres: string, apellidos: string, documento_identidad: string, tipo_documento?: string, email?: string, score?: number, telefono?: string): Promise<any>;
    listarClientes(): Promise<any[]>;
    obtenerClientePorId(id: string): Promise<any>;
    actualizarCliente(id: string, datos: {
        nombres?: string;
        apellidos?: string;
        email?: string;
        score?: number;
        telefono?: string;
    }): Promise<any>;
    inactivarCliente(id: string): Promise<any>;
}
