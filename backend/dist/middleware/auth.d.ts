import { Request, Response, NextFunction } from "express";
export interface JwtPayload {
    id: string;
    nombre: string;
    rol: "ADMINISTRADOR" | "ESTANDAR";
    permisos: string[];
}
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function generateToken(payload: JwtPayload): string;
