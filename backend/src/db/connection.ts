// import { Pool } from "pg";
// import * as dotenv from "dotenv";
// dotenv.config();

// // 1. Buscamos PRIMERO si existe la variable de Render. 
// // Si dotenvx la borró del process.env, podemos usar un fallback o asegurarnos de que Render la inyecte.
// const connectionString = process.env.DATABASE_URL;

// export const pool = new Pool(
//   connectionString
//     ? {
//         connectionString: connectionString,
//         ssl: { rejectUnauthorized: false },
//       }
//     : {
//         // Esto solo correrá en tu computadora local si DATABASE_URL no existe
//         host: process.env.DB_HOST || "localhost",
//         port: Number(process.env.DB_PORT) || 5432,
//         user: process.env.DB_USER || "postgres",
//         password: process.env.DB_PASSWORD,
//         database: process.env.DB_NAME,
//         ssl: false,
//       }
// );


import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

// 1. Buscamos PRIMERO si existe la variable de Render. 
// Si dotenvx la borró del process.env, podemos usar un fallback o asegurarnos de que Render la inyecte.
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? {
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
      }
    : {
        // Esto solo correrá en tu computadora local si DATABASE_URL no existe
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: false,
      }
);