import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import authRouter from "./auth.js";
import organizationRouter from "./organization.js";
import resourcesRouter from "./resources.js";
import endpointGroupsRouter from "./endpoint-groups.js";
import blocklistsRouter from "./blocklists.js";
import allowlistsRouter from "./allowlists.js";
import rateLimitsRouter from "./rate-limits.js";
import presetsRouter from "./presets.js";
import apiKeysRouter from "./api-keys.js";
import logsRouter from "./logs.js";

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────
router.use("/auth", authRouter);

// ── Protected routes (JWT required — admin-only) ──────────────────────
router.use("/organization", authenticate, organizationRouter);
router.use("/resources", authenticate, resourcesRouter);
router.use("/ip-blocklists", authenticate, blocklistsRouter);
router.use("/ip-allowlists", authenticate, allowlistsRouter);
router.use("/rate-limits", authenticate, rateLimitsRouter);
router.use("/presets", authenticate, presetsRouter);
router.use("/api-keys", authenticate, apiKeysRouter);
router.use("/logs", authenticate, logsRouter);

// These routers define their own path prefixes (/endpoint-groups/...)
router.use("/", authenticate, endpointGroupsRouter);

export default router;
