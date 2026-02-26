import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createAllowlistSchema,
  updateAllowlistSchema,
} from "../validators/allowlists.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as allowlistsCtrl from "../controllers/allowlists.controller.js";

const router = Router();

router.get("/", asyncCatch(allowlistsCtrl.list));
router.post(
  "/",
  validate(createAllowlistSchema),
  asyncCatch(allowlistsCtrl.create),
);
router.put(
  "/:id",
  validate(updateAllowlistSchema),
  asyncCatch(allowlistsCtrl.update),
);
router.get(
  "/:id/associated-presets",
  asyncCatch(allowlistsCtrl.getAssociatedPresets),
);
router.delete("/:id", asyncCatch(allowlistsCtrl.remove));

export default router;
