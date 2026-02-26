import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createBlocklistSchema,
  updateBlocklistSchema,
} from "../validators/blocklists.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as blocklistsCtrl from "../controllers/blocklists.controller.js";

const router = Router();

router.get("/", asyncCatch(blocklistsCtrl.list));
router.post(
  "/",
  validate(createBlocklistSchema),
  asyncCatch(blocklistsCtrl.create),
);
router.put(
  "/:id",
  validate(updateBlocklistSchema),
  asyncCatch(blocklistsCtrl.update),
);
router.get(
  "/:id/associated-presets",
  asyncCatch(blocklistsCtrl.getAssociatedPresets),
);
router.delete("/:id", asyncCatch(blocklistsCtrl.remove));

export default router;
