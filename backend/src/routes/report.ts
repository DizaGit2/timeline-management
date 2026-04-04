import { Router } from "express";
import { hoursReport, unfilledReport, scheduleCsv } from "../controllers/report";
import { authGuard, requireRole } from "../middleware/authGuard";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);
router.use(requireRole("MANAGER", "ADMIN"));

router.get("/hours", asyncHandler(hoursReport));
router.get("/unfilled", asyncHandler(unfilledReport));
router.get("/schedule/csv", asyncHandler(scheduleCsv));

export default router;
