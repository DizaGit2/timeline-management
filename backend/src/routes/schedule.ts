import { Router } from "express";
import { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule } from "../controllers/schedule";
import { validate } from "../middleware/validate";
import { authGuard } from "../middleware/authGuard";
import { createScheduleSchema, updateScheduleSchema } from "../validators/schedule";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

router.get("/", asyncHandler(listSchedules));
router.get("/:id", asyncHandler(getSchedule));
router.post("/", validate(createScheduleSchema), asyncHandler(createSchedule));
router.put("/:id", validate(updateScheduleSchema), asyncHandler(updateSchedule));
router.delete("/:id", asyncHandler(deleteSchedule));

export default router;
