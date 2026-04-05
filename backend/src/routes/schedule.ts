import { Router } from "express";
import { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, copyWeek } from "../controllers/schedule";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { createScheduleSchema, updateScheduleSchema, copyWeekSchema } from "../validators/schedule";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

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
