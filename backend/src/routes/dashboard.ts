import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard";
import { authGuard, requireRole } from "../middleware/authGuard";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);
router.use(requireRole("MANAGER", "ADMIN"));

router.get("/stats", asyncHandler(getDashboardStats));

export default router;
