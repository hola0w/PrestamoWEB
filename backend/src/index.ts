import * as dotenv from "dotenv";
dotenv.config();


import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth";
import clientesRouter    from "./routes/clientes";
import prestamosRouter   from "./routes/prestamos";
import cobrosRouter      from "./routes/cobro";
import cuotasRouter      from "./routes/cuotas";
import reportesRouter    from "./routes/Reportes/reportes";

// En app.ts
import healthRouter from "./routes/health";


// Reportes nuevos por categoría (deben montarse ANTES que /api/reportes
// genérico — ver nota más abajo)
import reportesCarteraRouter   from "./routes/Reportes/cartera";
import reportesPrestamosRouter from "./routes/Reportes/prestamos";
import reportesCobrosRouter    from "./routes/Reportes/cobros";

import authRouter        from "./routes/auth";
import { usuarioRouter } from "./routes/usuario";

// Catálogos multiempresa
import sucursalesRouter from "./routes/Sucursales";
import zonasRouter      from "./routes/ZonasRoutes";

const app = express();
//app.use(cors());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://prestamo-web-gamma.vercel.app"
    ],
    credentials: true
  })
);


app.use(express.json());

// Pública
app.use("/api/auth", authRouter);
app.use("/api/health", healthRouter);
// Protegidas — catálogos
app.use("/api/clientes",   authMiddleware, clientesRouter);
app.use("/api/prestamos",  authMiddleware, prestamosRouter);
app.use("/api/cobros",     authMiddleware, cobrosRouter);
app.use("/api/cuotas",     authMiddleware, cuotasRouter);
app.use("/api/usuarios",   authMiddleware, usuarioRouter);
app.use("/api/sucursales", sucursalesRouter); // authMiddleware ya aplicado dentro del router
app.use("/api/zonas",      zonasRouter);      // authMiddleware ya aplicado dentro del router

// IMPORTANTE: las rutas de reportes específicas por categoría deben ir
// ANTES que "/api/reportes" genérico. Express monta por orden de
// declaración, así que si "/api/reportes" se registra primero, intercepta
// también las peticiones a "/api/reportes/cartera/*", "/api/reportes/prestamos/*",
// etc. y nunca llegan a sus routers correspondientes (causa el 404 que
// se vio en consola).
app.use("/api/reportes/cartera",   reportesCarteraRouter);   // authMiddleware ya aplicado dentro del router
app.use("/api/reportes/prestamos", reportesPrestamosRouter); // authMiddleware ya aplicado dentro del router
app.use("/api/reportes/cobros",    reportesCobrosRouter);    // authMiddleware ya aplicado dentro del router

// Genérico — debe ir DESPUÉS de las específicas de arriba
app.use("/api/reportes", authMiddleware, reportesRouter);

app.listen(process.env.PORT || 1000, () => {
  console.log(`API corriendo en http://localhost:${process.env.PORT || 1000}`);
});