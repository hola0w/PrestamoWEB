// src/routes/health.ts
import { Router } from "express";
import { pool } from "../db/connection"; // tu instancia de pg Pool

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

export default router;