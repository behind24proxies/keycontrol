import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createApiKeySchema,
  updateApiKeySchema,
  deleteApiKeySchema,
} from "../validators/api-keys.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as apiKeysCtrl from "../controllers/apiKeys.controller.js";

const router = Router();

// All API key routes are admin-only (auth enforced at index level)
router.get("/", asyncCatch(apiKeysCtrl.list));
router.get("/:id", asyncCatch(apiKeysCtrl.get));
router.post("/", validate(createApiKeySchema), asyncCatch(apiKeysCtrl.create));
router.put(
  "/:id",
  validate(updateApiKeySchema),
  asyncCatch(apiKeysCtrl.update),
);
router.get("/:id/stats", asyncCatch(apiKeysCtrl.stats));

router.delete(
  "/:id",
  validate(deleteApiKeySchema),
  asyncCatch(apiKeysCtrl.remove),
);

export default router;
