import { Router } from "express";
import express from "express";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as gatewayCtrl from "../controllers/gateway.controller.js";

const router = Router();

// Gateway uses API-key auth (not JWT) — no authenticate/requireRole middleware
// Use express.raw() to capture body as a Buffer for all content types,
// preserving binary data integrity for file uploads (e.g. Bunny CDN storage)
router.all(
  "/:projectPath",
  express.raw({ type: "*/*", limit: "50mb" }),
  asyncCatch(gatewayCtrl.proxy),
);

export default router;
