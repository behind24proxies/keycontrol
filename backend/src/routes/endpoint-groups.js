import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createEndpointGroupSchema,
  updateEndpointGroupSchema,
} from "../validators/endpoint-groups.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as endpointGroupsCtrl from "../controllers/endpointGroups.controller.js";

const router = Router();

// All endpoint-group routes are admin-only (auth enforced at index level)
router.post(
  "/resources/:resourceId/endpoint-groups",
  validate(createEndpointGroupSchema),
  asyncCatch(endpointGroupsCtrl.create),
);
router.put(
  "/endpoint-groups/:id",
  validate(updateEndpointGroupSchema),
  asyncCatch(endpointGroupsCtrl.update),
);
router.get(
  "/endpoint-groups/:id/associated-keys",
  asyncCatch(endpointGroupsCtrl.getAssociatedKeys),
);
router.delete(
  "/endpoint-groups/:id",
  asyncCatch(endpointGroupsCtrl.remove),
);

export default router;
