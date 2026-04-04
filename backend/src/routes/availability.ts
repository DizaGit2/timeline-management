import { Router } from "express";
import {
  getAvailability,
  replaceAvailability,
  listUnavailability,
  createUnavailability,
  deleteUnavailability,
  weekAvailabilitySummary,
} from "../controllers/availability";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { replaceAvailabilitySchema, createUnavailabilitySchema } from "../validators/availability";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

// Week summary — Manager and Admin only
router.get("/week", requireRole("MANAGER", "ADMIN"), asyncHandler(weekAvailabilitySummary));

export default router;

// Employee-scoped availability routes (mounted under /api/employees/:id)
export const employeeAvailabilityRouter = Router({ mergeParams: true });

employeeAvailabilityRouter.use(authGuard);

// Recurring availability windows
employeeAvailabilityRouter.get("/availability", asyncHandler(getAvailability));
employeeAvailabilityRouter.put("/availability", validate(replaceAvailabilitySchema), asyncHandler(replaceAvailability));

// One-off unavailability exceptions
employeeAvailabilityRouter.get("/unavailability", asyncHandler(listUnavailability));
employeeAvailabilityRouter.post("/unavailability", validate(createUnavailabilitySchema), asyncHandler(createUnavailability));
employeeAvailabilityRouter.delete("/unavailability/:eid", asyncHandler(deleteUnavailability));
