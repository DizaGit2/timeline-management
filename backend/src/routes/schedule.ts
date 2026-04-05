import { Router } from "express";
import rateLimit from "express-rate-limit";
import { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, copyWeek } from "../controllers/schedule";
import { listScheduleShifts, createNestedShift } from "../controllers/shift";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { createScheduleSchema, updateScheduleSchema, copyWeekSchema } from "../validators/schedule";
import { createNestedShiftSchema } from "../validators/shift";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Nested shift endpoints — schedule drill-down (TIM-184)
router.get("/:scheduleId/shifts", asyncHandler(listScheduleShifts));
router.post("/:scheduleId/shifts", requireRole("MANAGER", "ADMIN"), validate(createNestedShiftSchema), asyncHandler(createNestedShift));

// Read endpoints — any authenticated user
router.get("/", asyncHandler(listSchedules));
router.get("/:id", asyncHandler(getSchedule));

// Write endpoints — Manager and Admin only
router.post("/copy-week", requireRole("MANAGER", "ADMIN"), validate(copyWeekSchema), asyncHandler(copyWeek));
router.post("/", requireRole("MANAGER", "ADMIN"), validate(createScheduleSchema), asyncHandler(createSchedule));
router.patch("/:id", requireRole("MANAGER", "ADMIN"), validate(updateScheduleSchema), asyncHandler(updateSchedule));
router.put("/:id", requireRole("MANAGER", "ADMIN"), validate(updateScheduleSchema), asyncHandler(updateSchedule));
router.delete("/:id", requireRole("MANAGER", "ADMIN"), asyncHandler(deleteSchedule));

export default router;
