import * as dotenv from "dotenv";
// Cargar variables de entorno antes que cualquier otro módulo
dotenv.config();

import express from "express";
import cors from "cors";
import { pool } from "./db/connection"; // Asegura que se inicialice la BD
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
      "https://prestamo-web-zc6i.vercel.app",
      "https://prestamo-web-psi.vercel.app",
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
app.use("/api/sucursales", authMiddleware, sucursalesRouter); // ← Se añade protección por seguridad
app.use("/api/zonas", authMiddleware, zonasRouter);      

// --- RUTAS DE REPORTES PROTEGIDAS ---
// Aplicamos 'authMiddleware' a CADA UNA para que puedan leer el token y los filtros sin fallar
//app.use("/api/reportes/cartera", authMiddleware, reportesCarteraRouter);   
//app.use("/api/reportes/prestamos", authMiddleware, reportesPrestamosRouter); 
//app.use("/api/reportes/cobros", authMiddleware, reportesCobrosRouter);    

// Ruta de reportes genérica (Captura /clientes-deuda y /cuotas-vencidas si están dentro de reportesRouter)
app.use("/api/reportes", authMiddleware, reportesRouter);

// Puerto dinámico requerido por Render
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 API corriendo exitosamente en el puerto ${PORT}`);
});