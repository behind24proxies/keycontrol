import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { loginSchema, loginVerify2FASchema } from "../validators/auth.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import * as authCtrl from "../controllers/auth.controller.js";

const router = Router();

// Public routes — no JWT required
router.post("/login", validate(loginSchema), asyncCatch(authCtrl.login));
router.post("/login/verify-2fa", validate(loginVerify2FASchema), asyncCatch(authCtrl.verify2FA));

export default router;
