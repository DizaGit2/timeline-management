import { Router } from "express";
import { listEmployees, listInactiveEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, reactivateEmployee } from "../controllers/employee";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { createEmployeeSchema, updateEmployeeSchema } from "../validators/employee";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

// Read endpoints — any authenticated user
router.get("/", asyncHandler(listEmployees));
router.get("/inactive", requireRole("ADMIN", "MANAGER"), asyncHandler(listInactiveEmployees));
router.get("/:id", asyncHandler(getEmployee));

// Write endpoints — Manager and Admin only
router.post("/", requireRole("ADMIN", "MANAGER"), validate(createEmployeeSchema), asyncHandler(createEmployee));
router.put("/:id", requireRole("ADMIN", "MANAGER"), validate(updateEmployeeSchema), asyncHandler(updateEmployee));
router.delete("/:id", requireRole("ADMIN", "MANAGER"), asyncHandler(deleteEmployee));
router.post("/:id/reactivate", requireRole("ADMIN"), asyncHandler(reactivateEmployee));

export default router;
