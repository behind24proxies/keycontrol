import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createResourceSchema,
  updateResourceSchema,
} from "../validators/resources.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as resourcesCtrl from "../controllers/resources.controller.js";

const router = Router();

// All resource routes are admin-only (auth enforced at index level)
router.get("/", asyncCatch(resourcesCtrl.list));
router.get("/:id", asyncCatch(resourcesCtrl.getById));
router.post(
  "/",
  validate(createResourceSchema),
  asyncCatch(resourcesCtrl.create),
);
router.put(
  "/:id",
  validate(updateResourceSchema),
  asyncCatch(resourcesCtrl.update),
);
router.delete("/:id", asyncCatch(resourcesCtrl.remove));

export default router;
