import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  CreateSwapRequestInput,
  RespondSwapRequestInput,
  ResolveSwapRequestInput,
} from "../validators/swapRequest";

const swapRequestInclude = {
  schedule: { select: { id: true, name: true } },
  requestingEmployee: {
    select: { id: true, firstName: true, lastName: true, position: true },
  },
  requestingShift: {
    select: { id: true, title: true, startTime: true, endTime: true, role: true },
  },
  targetEmployee: {
    select: { id: true, firstName: true, lastName: true, position: true },
  },
  targetShift: {
    select: { id: true, title: true, startTime: true, endTime: true, role: true },
  },
  resolver: { select: { id: true, name: true, email: true } },
};

/**
 * Resolve the Employee record for the current authenticated user within their org.
 */
async function resolveCurrentEmployee(userId: string, organizationId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return null;
  return prisma.employee.findFirst({
    where: { organizationId, email: user.email },
    select: { id: true },
  });
}

// POST /api/swap-requests
export async function createSwapRequest(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const data = req.body as CreateSwapRequestInput;

  // Resolve requesting employee from current user
  const requestingEmployee = await resolveCurrentEmployee(req.user!.userId, organizationId);
  if (!requestingEmployee) {
    throw new AppError(403, "No employee record linked to your account");
  }

  // Verify schedule belongs to org
  const schedule = await prisma.schedule.findFirst({
    where: { id: data.scheduleId, organizationId },
  });
  if (!schedule) throw new AppError(404, "Schedule not found");

  // Verify requesting shift belongs to schedule and is owned by requesting employee
  const requestingShift = await prisma.shift.findFirst({
    where: { id: data.requestingShiftId, scheduleId: data.scheduleId },
  });
  if (!requestingShift) throw new AppError(404, "Requesting shift not found in this schedule");

  if (requestingShift.employeeId !== requestingEmployee.id) {
    // Also check ShiftAssignment
    const assignment = await prisma.shiftAssignment.findUnique({
      where: {
        shiftId_employeeId: {
          shiftId: data.requestingShiftId,
          employeeId: requestingEmployee.id,
        },
      },
    });
    if (!assignment) {
      throw new AppError(403, "You are not assigned to the requesting shift");
    }
  }

  // Verify target employee belongs to org
  const targetEmployee = await prisma.employee.findFirst({
    where: { id: data.targetEmployeeId, organizationId },
  });
  if (!targetEmployee) throw new AppError(404, "Target employee not found");

  // Cannot swap with yourself
  if (data.targetEmployeeId === requestingEmployee.id) {
    throw new AppError(400, "Cannot create a swap request with yourself");
  }

  // Verify target shift belongs to schedule and is owned by target employee
  const targetShift = await prisma.shift.findFirst({
    where: { id: data.targetShiftId, scheduleId: data.scheduleId },
  });
  if (!targetShift) throw new AppError(404, "Target shift not found in this schedule");

  if (targetShift.employeeId !== data.targetEmployeeId) {
    const assignment = await prisma.shiftAssignment.findUnique({
      where: {
        shiftId_employeeId: {
          shiftId: data.targetShiftId,
          employeeId: data.targetEmployeeId,
        },
      },
    });
    if (!assignment) {
      throw new AppError(403, "Target employee is not assigned to the target shift");
    }
  }

  // Prevent duplicate pending requests for the same shift pair
  const duplicate = await prisma.swapRequest.findFirst({
    where: {
      requestingShiftId: data.requestingShiftId,
      targetShiftId: data.targetShiftId,
      status: { in: ["PENDING_TARGET", "PENDING_MANAGER"] },
    },
  });
  if (duplicate) {
    throw new AppError(409, "A pending swap request already exists for this shift pair");
  }

  const swapRequest = await prisma.swapRequest.create({
    data: {
      scheduleId: data.scheduleId,
      requestingEmployeeId: requestingEmployee.id,
      requestingShiftId: data.requestingShiftId,
      targetEmployeeId: data.targetEmployeeId,
      targetShiftId: data.targetShiftId,
      status: "PENDING_TARGET",
    },
    include: swapRequestInclude,
  });

  res.status(201).json(swapRequest);
}

// PATCH /api/swap-requests/:id/respond — target employee accepts/declines
export async function respondSwapRequest(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const { action } = req.body as RespondSwapRequestInput;

  const swapRequest = await prisma.swapRequest.findFirst({
    where: { id, schedule: { organizationId } },
  });
  if (!swapRequest) throw new AppError(404, "Swap request not found");

  if (swapRequest.status !== "PENDING_TARGET") {
    throw new AppError(400, "Swap request is not awaiting target response");
  }

  // Verify current user is the target employee
  const currentEmployee = await resolveCurrentEmployee(req.user!.userId, organizationId);
  if (!currentEmployee || currentEmployee.id !== swapRequest.targetEmployeeId) {
    throw new AppError(403, "Only the target employee can respond to this swap request");
  }

  const newStatus = action === "accept" ? "PENDING_MANAGER" : "REJECTED";

  const updated = await prisma.swapRequest.update({
    where: { id },
    data: {
      status: newStatus,
      ...(action === "decline" ? { resolvedAt: new Date() } : {}),
    },
    include: swapRequestInclude,
  });

  res.json(updated);
}

// PATCH /api/swap-requests/:id/resolve — manager approves/rejects
export async function resolveSwapRequest(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const { action } = req.body as ResolveSwapRequestInput;

  const swapRequest = await prisma.swapRequest.findFirst({
    where: { id, schedule: { organizationId } },
  });
  if (!swapRequest) throw new AppError(404, "Swap request not found");

  if (swapRequest.status !== "PENDING_MANAGER") {
    throw new AppError(400, "Swap request is not awaiting manager resolution");
  }

  if (action === "reject") {
    const updated = await prisma.swapRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolvedBy: req.user!.userId,
      },
      include: swapRequestInclude,
    });
    res.json(updated);
    return;
  }

  // Approve: atomically swap the shift assignments
  const reqShiftId = swapRequest.requestingShiftId;
  const tgtShiftId = swapRequest.targetShiftId;

  const updated = await prisma.$transaction(async (tx) => {
    // Update requesting shift: assign target employee
    await tx.shift.update({
      where: { id: reqShiftId },
      data: { employeeId: swapRequest.targetEmployeeId },
    });

    // Update target shift: assign requesting employee
    await tx.shift.update({
      where: { id: tgtShiftId },
      data: { employeeId: swapRequest.requestingEmployeeId },
    });

    // Also swap ShiftAssignments if they exist
    const reqAssignment = await tx.shiftAssignment.findUnique({
      where: {
        shiftId_employeeId: {
          shiftId: reqShiftId,
          employeeId: swapRequest.requestingEmployeeId,
        },
      },
    });
    const tgtAssignment = await tx.shiftAssignment.findUnique({
      where: {
        shiftId_employeeId: {
          shiftId: tgtShiftId,
          employeeId: swapRequest.targetEmployeeId,
        },
      },
    });

    if (reqAssignment) {
      await tx.shiftAssignment.delete({
        where: {
          shiftId_employeeId: {
            shiftId: reqShiftId,
            employeeId: swapRequest.requestingEmployeeId,
          },
        },
      });
      await tx.shiftAssignment.create({
        data: { shiftId: reqShiftId, employeeId: swapRequest.targetEmployeeId },
      });
    }

    if (tgtAssignment) {
      await tx.shiftAssignment.delete({
        where: {
          shiftId_employeeId: {
            shiftId: tgtShiftId,
            employeeId: swapRequest.targetEmployeeId,
          },
        },
      });
      await tx.shiftAssignment.create({
        data: { shiftId: tgtShiftId, employeeId: swapRequest.requestingEmployeeId },
      });
    }

    // Cancel any other pending swaps involving these shifts
    await tx.swapRequest.updateMany({
      where: {
        id: { not: id },
        status: { in: ["PENDING_TARGET", "PENDING_MANAGER"] },
        OR: [
          { requestingShiftId: { in: [reqShiftId, tgtShiftId] } },
          { targetShiftId: { in: [reqShiftId, tgtShiftId] } },
        ],
      },
      data: { status: "CANCELLED" },
    });

    return tx.swapRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedBy: req.user!.userId,
      },
      include: swapRequestInclude,
    });
  });

  res.json(updated);
}

// GET /api/swap-requests
export async function listSwapRequests(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { scheduleId, status } = req.query;

  const where: Record<string, unknown> = {
    schedule: { organizationId },
  };
  if (scheduleId) where.scheduleId = scheduleId as string;
  if (status) {
    const statuses = (status as string).split(",").map((s) => s.trim().toUpperCase());
    where.status = { in: statuses };
  }

  const swapRequests = await prisma.swapRequest.findMany({
    where,
    include: swapRequestInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json(swapRequests);
}

// GET /api/swap-requests/:id
export async function getSwapRequest(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const swapRequest = await prisma.swapRequest.findFirst({
    where: { id, schedule: { organizationId } },
    include: swapRequestInclude,
  });
  if (!swapRequest) throw new AppError(404, "Swap request not found");

  res.json(swapRequest);
}
