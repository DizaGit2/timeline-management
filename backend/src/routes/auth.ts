import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, refresh, logout, forgotPassword, resetPassword } from "../controllers/auth";
import { validate } from "../middleware/validate";
import { authGuard } from "../middleware/authGuard";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts, please try again later" } },
});

router.post("/register", validate(registerSchema), asyncHandler(register));
router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(login));
router.post("/refresh", validate(refreshSchema), asyncHandler(refresh));
router.post("/logout", authGuard, asyncHandler(logout));
router.post("/forgot-password", loginLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post("/reset-password", validate(resetPasswordSchema), asyncHandler(resetPassword));

export default router;
