import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { getLogsSchema, updateLogSettingsSchema } from "../validators/logs.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as logsCtrl from "../controllers/logs.controller.js";

const router = Router();

// All log routes are admin-only (auth enforced at index level)
router.get(
  "/",
  validate(getLogsSchema),
  asyncCatch(logsCtrl.list),
);

router.get("/stats", asyncCatch(logsCtrl.getStats));
router.get("/settings", asyncCatch(logsCtrl.getSettings));
router.put("/settings", validate(updateLogSettingsSchema), asyncCatch(logsCtrl.updateSettings));

export default router;
