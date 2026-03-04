import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as schemas from "../validators/organization.js";
import * as orgCtrl from "../controllers/organization.controller.js";

const router = Router();

// Profile
router.get("/profile", asyncCatch(orgCtrl.getProfile));

// Organization code
router.put(
  "/organization-code",
  validate(schemas.updateOrganizationCodeSchema),
  asyncCatch(orgCtrl.updateOrganizationCode),
);

// 2FA
router.post("/two-factor/generate", asyncCatch(orgCtrl.generate2FA));
router.post(
  "/two-factor/verify",
  validate(schemas.verify2FASchema),
  asyncCatch(orgCtrl.verify2FA),
);
router.post(
  "/two-factor/disable",
  validate(schemas.disable2FASchema),
  asyncCatch(orgCtrl.disable2FA),
);

// Session timeout
router.put(
  "/session-timeout",
  validate(schemas.sessionTimeoutSchema),
  asyncCatch(orgCtrl.updateSessionTimeout),
);

// IP logging
router.put(
  "/ip-logging",
  validate(schemas.ipLoggingSchema),
  asyncCatch(orgCtrl.updateIpLogging),
);

// Debug mode
router.put(
  "/debug-mode",
  validate(schemas.debugModeSchema),
  asyncCatch(orgCtrl.updateDebugMode),
);

// Master API key
router.post("/master-key/generate", asyncCatch(orgCtrl.generateMasterKey));
router.delete("/master-key", asyncCatch(orgCtrl.revokeMasterKey));

// Password management
router.put(
  "/password",
  validate(schemas.changePasswordSchema),
  asyncCatch(orgCtrl.changePassword),
);

export default router;
