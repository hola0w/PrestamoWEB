"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/health.ts
const express_1 = require("express");
const connection_1 = require("../db/connection"); // tu instancia de pg Pool
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    try {
        await connection_1.pool.query("SELECT 1");
        res.json({ ok: true });
    }
    catch {
        res.status(503).json({ ok: false });
    }
});
exports.default = router;
//# sourceMappingURL=health.js.map