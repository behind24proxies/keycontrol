import { Router } from "express";
import express from "express";
import { asyncCatch } from "../middleware/asyncCatch.js";
import { gatewayLogger } from "../middleware/gateway-logger.js";
import * as gatewayCtrl from "../controllers/gateway.controller.js";

const router = Router();

// Gateway uses API-key auth (not JWT) — no authenticate/requireRole middleware
// Use express.raw() to capture body as a Buffer for all content types,
// preserving binary data integrity for file uploads (e.g. Bunny CDN storage)
//
// gatewayLogger() intercepts res.send() to log requests automatically,
// eliminating the need for manual logBuffer.push() calls in the controller.
//
// Wildcard route: /gateway/:resourcePath/<endpoint-path>
// e.g. /gateway/groq/chat/completions → resourcePath="groq", endpointPath="/chat/completions"
const rawBody = express.raw({ type: "*/*", limit: "50mb" });
router.all("/:resourcePath/*", gatewayLogger(), rawBody, asyncCatch(gatewayCtrl.proxy));
router.all("/:resourcePath", gatewayLogger(), rawBody, asyncCatch(gatewayCtrl.proxy));

export default router;
