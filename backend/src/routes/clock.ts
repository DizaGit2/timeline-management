import { Router } from "express";
import {
  syncClockEvents,
  clockInOut,
  getClockStatus,
  listTimeEntries,
  listPendingEvents,
} from "../controllers/clock";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import { syncClockEventsSchema, clockInOutSchema } from "../validators/clock";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

// Any authenticated user
router.post("/sync", validate(syncClockEventsSchema), asyncHandler(syncClockEvents));
router.post("/", validate(clockInOutSchema), asyncHandler(clockInOut));
router.get("/status", asyncHandler(getClockStatus));
router.get("/entries", asyncHandler(listTimeEntries));

// Manager/Admin only
router.get("/pending", requireRole("MANAGER", "ADMIN"), asyncHandler(listPendingEvents));

export default router;
