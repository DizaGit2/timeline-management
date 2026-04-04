import { Router } from "express";
import { listNotifications, markAsRead, markAllAsRead } from "../controllers/notification";
import { authGuard } from "../middleware/authGuard";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.use(authGuard);

router.get("/", asyncHandler(listNotifications));
router.patch("/:id/read", asyncHandler(markAsRead));
router.post("/read-all", asyncHandler(markAllAsRead));

export default router;
