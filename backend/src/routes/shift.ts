import { Router } from "express";
import {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  assignEmployees,
  removeAssignment,
  getShiftConflicts,
} from "../controllers/shift";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import {
  createShiftSchema,
  updateShiftSchema,
  assignEmployeesSchema,
} from "../validators/shift";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

// Read endpoints — any authenticated user
router.get("/", asyncHandler(listShifts));
router.get("/:id", asyncHandler(getShift));
router.get("/:id/conflicts", asyncHandler(getShiftConflicts));

// Write endpoints — Manager and Admin only
router.post("/", requireRole("MANAGER", "ADMIN"), validate(createShiftSchema), asyncHandler(createShift));
router.put("/:id", requireRole("MANAGER", "ADMIN"), validate(updateShiftSchema), asyncHandler(updateShift));
router.delete("/:id", requireRole("MANAGER", "ADMIN"), asyncHandler(deleteShift));
router.post(
  "/:id/assign",
  requireRole("MANAGER", "ADMIN"),
  validate(assignEmployeesSchema),
  asyncHandler(assignEmployees)
);
router.delete("/:id/employees/:eid", requireRole("MANAGER", "ADMIN"), asyncHandler(removeAssignment));

export default router;
