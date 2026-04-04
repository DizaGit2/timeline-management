import { Router } from "express";
import { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from "../controllers/employee";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { createEmployeeSchema, updateEmployeeSchema } from "../validators/employee";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

router.get("/", asyncHandler(listEmployees));
router.get("/:id", asyncHandler(getEmployee));
router.post("/", requireRole("ADMIN", "MANAGER"), validate(createEmployeeSchema), asyncHandler(createEmployee));
router.put("/:id", requireRole("ADMIN", "MANAGER"), validate(updateEmployeeSchema), asyncHandler(updateEmployee));
router.delete("/:id", requireRole("ADMIN", "MANAGER"), asyncHandler(deleteEmployee));

export default router;
