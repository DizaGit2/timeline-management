import { Router } from "express";
import {
  createSwapRequest,
  respondSwapRequest,
  resolveSwapRequest,
  listSwapRequests,
  getSwapRequest,
} from "../controllers/swapRequest";
import { validate } from "../middleware/validate";
import { authGuard, requireRole } from "../middleware/authGuard";
import {
  createSwapRequestSchema,
  respondSwapRequestSchema,
  resolveSwapRequestSchema,
} from "../validators/swapRequest";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

// Read endpoints — any authenticated user
router.get("/", asyncHandler(listSwapRequests));
router.get("/:id", asyncHandler(getSwapRequest));

// Create — any authenticated user (employee initiates)
router.post("/", validate(createSwapRequestSchema), asyncHandler(createSwapRequest));

// Target employee responds (accept/decline)
router.patch("/:id/respond", validate(respondSwapRequestSchema), asyncHandler(respondSwapRequest));

// Manager/Admin resolves (approve/reject)
router.patch(
  "/:id/resolve",
  requireRole("MANAGER", "ADMIN"),
  validate(resolveSwapRequestSchema),
  asyncHandler(resolveSwapRequest)
);

export default router;
