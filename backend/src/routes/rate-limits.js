import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createRateLimitSchema,
  updateRateLimitSchema,
} from "../validators/rate-limits.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as rateLimitsCtrl from "../controllers/rateLimits.controller.js";

const router = Router();

router.get("/", asyncCatch(rateLimitsCtrl.list));
router.post(
  "/",
  validate(createRateLimitSchema),
  asyncCatch(rateLimitsCtrl.create),
);
router.put(
  "/:id",
  validate(updateRateLimitSchema),
  asyncCatch(rateLimitsCtrl.update),
);
router.get(
  "/:id/associated-presets",
  asyncCatch(rateLimitsCtrl.getAssociatedPresets),
);
router.delete("/:id", asyncCatch(rateLimitsCtrl.remove));

export default router;
