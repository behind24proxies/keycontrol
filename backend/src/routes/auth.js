import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { loginSchema, loginVerify2FASchema, resetPasswordSchema } from "../validators/auth.js";
import { asyncCatch } from "../middleware/asyncCatch.js";
import { loginRateLimiter } from "../middleware/auth.js";
import * as authCtrl from "../controllers/auth.controller.js";

const router = Router();

// Public routes — no JWT required, rate-limited
router.post("/login", loginRateLimiter, validate(loginSchema), asyncCatch(authCtrl.login));
router.post("/login/verify-2fa", loginRateLimiter, validate(loginVerify2FASchema), asyncCatch(authCtrl.verify2FA));
router.post("/reset-password", loginRateLimiter, validate(resetPasswordSchema), asyncCatch(authCtrl.resetPassword));

export default router;
