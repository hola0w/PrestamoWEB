"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.generateToken = generateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const SECRET = process.env.JWT_SECRET || "tu_secreto_aqui";
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token requerido" });
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, SECRET);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
}
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, SECRET, { expiresIn: "8h" });
}
//# sourceMappingURL=auth.js.map