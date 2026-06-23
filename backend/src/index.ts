import * as dotenv from "dotenv";
// Cargar variables de entorno antes que cualquier otro módulo
dotenv.config();

import express from "express";
import cors from "cors";
import { pool } from "./config/database"; // Asegura que se inicialice la BD
import { authMiddleware } from "./middleware/auth";

// Importación de enrutadores
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import clientesRouter from "./routes/clientes";
import prestamosRouter from "./routes/prestamos";
import cobrosRouter from "./routes/cobro";
import cuotasRouter from "./routes/cuotas";
import { usuarioRouter } from "./routes/usuario";
import sucursalesRouter from "./routes/Sucursales";
import zonasRouter from "./routes/ZonasRoutes";

// Enrutadores de Reportes
import reportesRouter from "./routes/Reportes/reportes";
import reportesCarteraRouter from "./routes/Reportes/cartera";
import reportesPrestamosRouter from "./routes/Reportes/prestamos";
import reportesCobrosRouter from "./routes/Reportes/cobros";

const app = express();

// Configuración de CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://prestamo-web-zc6i.vercel.app"
    ],
    credentials: true
  })
);

app.use(express.json());

// --- RUTAS PÚBLICAS ---
app.use("/api/auth", authRouter);
app.use("/api/health", healthRouter);

// --- RUTAS PROTEGIDAS (CATÁLOGOS) ---
app.use("/api/clientes", authMiddleware, clientesRouter);
app.use("/api/prestamos", authMiddleware, prestamosRouter);
app.use("/api/cobros", authMiddleware, cobrosRouter);
app.use("/api/cuotas", authMiddleware, cuotasRouter);
app.use("/api/usuarios", authMiddleware, usuarioRouter);
app.use("/api/sucursales", sucursalesRouter); 
app.use("/api/zonas", zonasRouter);      

// --- RUTAS DE REPORTES ---
// NOTA: Las rutas específicas se declaran ANTES que la genérica para evitar conflictos 404
app.use("/api/reportes/cartera", reportesCarteraRouter);   
app.use("/api/reportes/prestamos", reportesPrestamosRouter); 
app.use("/api/reportes/cobros", reportesCobrosRouter);    

// Ruta de reportes genérica (captura el resto)
app.use("/api/reportes", authMiddleware, reportesRouter);

// Puerto dinámico requerido por Render
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 API corriendo exitosamente en el puerto ${PORT}`);
});