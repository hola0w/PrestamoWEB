"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./middleware/auth");
const clientes_1 = __importDefault(require("./routes/clientes"));
const prestamos_1 = __importDefault(require("./routes/prestamos"));
const cobro_1 = __importDefault(require("./routes/cobro"));
const cuotas_1 = __importDefault(require("./routes/cuotas"));
const reportes_1 = __importDefault(require("./routes/Reportes/reportes"));
// En app.ts
const health_1 = __importDefault(require("./routes/health"));
// Reportes nuevos por categoría (deben montarse ANTES que /api/reportes
// genérico — ver nota más abajo)
const cartera_1 = __importDefault(require("./routes/Reportes/cartera"));
const prestamos_2 = __importDefault(require("./routes/Reportes/prestamos"));
const cobros_1 = __importDefault(require("./routes/Reportes/cobros"));
const auth_2 = __importDefault(require("./routes/auth"));
const usuario_1 = require("./routes/usuario");
// Catálogos multiempresa
const Sucursales_1 = __importDefault(require("./routes/Sucursales"));
const ZonasRoutes_1 = __importDefault(require("./routes/ZonasRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Pública
app.use("/api/auth", auth_2.default);
app.use("/api/health", health_1.default);
// Protegidas — catálogos
app.use("/api/clientes", auth_1.authMiddleware, clientes_1.default);
app.use("/api/prestamos", auth_1.authMiddleware, prestamos_1.default);
app.use("/api/cobros", auth_1.authMiddleware, cobro_1.default);
app.use("/api/cuotas", auth_1.authMiddleware, cuotas_1.default);
app.use("/api/usuarios", auth_1.authMiddleware, usuario_1.usuarioRouter);
app.use("/api/sucursales", Sucursales_1.default); // authMiddleware ya aplicado dentro del router
app.use("/api/zonas", ZonasRoutes_1.default); // authMiddleware ya aplicado dentro del router
// IMPORTANTE: las rutas de reportes específicas por categoría deben ir
// ANTES que "/api/reportes" genérico. Express monta por orden de
// declaración, así que si "/api/reportes" se registra primero, intercepta
// también las peticiones a "/api/reportes/cartera/*", "/api/reportes/prestamos/*",
// etc. y nunca llegan a sus routers correspondientes (causa el 404 que
// se vio en consola).
app.use("/api/reportes/cartera", cartera_1.default); // authMiddleware ya aplicado dentro del router
app.use("/api/reportes/prestamos", prestamos_2.default); // authMiddleware ya aplicado dentro del router
app.use("/api/reportes/cobros", cobros_1.default); // authMiddleware ya aplicado dentro del router
// Genérico — debe ir DESPUÉS de las específicas de arriba
app.use("/api/reportes", auth_1.authMiddleware, reportes_1.default);
app.listen(process.env.PORT || 1000, () => {
    console.log(`API corriendo en http://localhost:${process.env.PORT || 1000}`);
});
//# sourceMappingURL=index.js.map