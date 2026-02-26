import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createPresetSchema,
  updatePresetSchema,
  duplicatePresetSchema,
  deletePresetSchema,
  batchUpdatePresetsSchema,
} from "../validators/presets.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as presetsCtrl from "../controllers/presets.controller.js";

const router = Router();

// All preset routes are admin-only (auth enforced at index level)
router.get("/", asyncCatch(presetsCtrl.list));

// Batch-update must be registered before /:id to avoid param collision
router.post(
  "/batch-update",
  validate(batchUpdatePresetsSchema),
  asyncCatch(presetsCtrl.batchUpdate),
);

router.get("/:id", asyncCatch(presetsCtrl.get));
router.post(
  "/",
  validate(createPresetSchema),
  asyncCatch(presetsCtrl.create),
);
router.put(
  "/:id",
  validate(updatePresetSchema),
  asyncCatch(presetsCtrl.update),
);
router.post(
  "/:id/duplicate",
  validate(duplicatePresetSchema),
  asyncCatch(presetsCtrl.duplicate),
);
router.delete(
  "/:id",
  validate(deletePresetSchema),
  asyncCatch(presetsCtrl.remove),
);

export default router;
