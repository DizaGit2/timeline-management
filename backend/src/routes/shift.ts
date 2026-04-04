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
import { authGuard } from "../middleware/authGuard";
import {
  createShiftSchema,
  updateShiftSchema,
  assignEmployeesSchema,
} from "../validators/shift";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

router.get("/", asyncHandler(listShifts));
router.get("/:id", asyncHandler(getShift));
router.post("/", validate(createShiftSchema), asyncHandler(createShift));
router.put("/:id", validate(updateShiftSchema), asyncHandler(updateShift));
router.delete("/:id", asyncHandler(deleteShift));
router.post(
  "/:id/assign",
  validate(assignEmployeesSchema),
  asyncHandler(assignEmployees)
);
router.delete("/:id/employees/:eid", asyncHandler(removeAssignment));
router.get("/:id/conflicts", asyncHandler(getShiftConflicts));

export default router;
