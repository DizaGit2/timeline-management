import { Router } from "express";
import { createUser, getMe } from "../controllers/user";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { createUserSchema } from "../validators/user";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/me", authGuard, asyncHandler(getMe));
router.post("/", authGuard, requireRole("ADMIN", "MANAGER"), validate(createUserSchema), asyncHandler(createUser));

export default router;
