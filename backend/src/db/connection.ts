import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

// Verificamos si existe la URL completa (lo ideal para Render), 
// de lo contrario usamos los parámetros por separado (para tu local)
const isProduction = process.env.NODE_ENV === "production" || process.env.DATABASE_URL;

export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      }
);