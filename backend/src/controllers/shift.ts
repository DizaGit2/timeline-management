import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  CreateShiftInput,
  CreateNestedShiftInput,
  UpdateShiftInput,
  AssignEmployeesInput,
} from "../validators/shift";
import { notifyShiftAssigned, notifyShiftUpdated, notifyShiftRemoved } from "../lib/notifications";

const shiftInclude = {
  employee: {
    select: { id: true, firstName: true, lastName: true, position: true },
  },
  schedule: { select: { id: true, name: true } },
  assignments: {
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
    },
    orderBy: { assignedAt: "asc" as const },
  },
};

export async function listShifts(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { scheduleId, employeeId: rawEmployeeId, from, to } = req.query;

  // Resolve "me" — look up the Employee record matching the current user's email
  let employeeId = rawEmployeeId as string | undefined;
  if (rawEmployeeId === "me") {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    if (user?.email) {
      const emp = await prisma.employee.findFirst({
        where: { organizationId, email: user.email },
        select: { id: true },
      });
      employeeId = emp?.id;
    }
    if (!employeeId) {
      res.json([]);
      return;
    }
  }

  const shifts = await prisma.shift.findMany({
    where: {
      schedule: { organizationId },
      ...(scheduleId ? { scheduleId: scheduleId as string } : {}),
      // Include shifts assigned via legacy employeeId field OR via ShiftAssignment
      ...(employeeId
        ? {
            OR: [
              { employeeId },
              { assignments: { some: { employeeId } } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from as string) } : {}),
              ...(to ? { lte: new Date(to as string) } : {}),
            },
          }
        : {}),
    },
    include: shiftInclude,
    orderBy: { startTime: "asc" },
  });

  res.json(shifts);
}

export async function getShift(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const shift = await prisma.shift.findFirst({
    where: { id, schedule: { organizationId } },
    include: shiftInclude,
  });

  if (!shift) throw new AppError(404, "Shift not found");

  res.json(shift);
}

async function checkOverlap(
  employeeId: string,
  startTime: Date,
  endTime: Date,
  excludeShiftId?: string
): Promise<void> {
  const where: Record<string, unknown> = {
    startTime: { lt: endTime },
    endTime: { gt: startTime },
    OR: [
      { employeeId },
      { assignments: { some: { employeeId } } },
    ],
  };
  if (excludeShiftId) {
    where.id = { not: excludeShiftId };
  }

  const overlapping = await prisma.shift.findFirst({ where });
  if (overlapping) {
    throw new AppError(
      409,
      "Employee already has an overlapping shift during this time period"
    );
  }
}

export async function createShift(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const data = req.body as CreateShiftInput;

  const schedule = await prisma.schedule.findFirst({
    where: { id: data.scheduleId, organizationId },
  });
  if (!schedule) throw new AppError(404, "Schedule not found");

  if (data.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId },
    });
    if (!employee) throw new AppError(404, "Employee not found");

    await checkOverlap(
      data.employeeId,
      new Date(data.startTime),
      new Date(data.endTime)
    );
  }

  const shift = await prisma.shift.create({
    data: {
      scheduleId: data.scheduleId,
      employeeId: data.employeeId ?? null,
      title: data.title,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      location: data.location,
      role: data.role,
      requiredHeadcount: data.requiredHeadcount ?? 1,
      notes: data.notes,
    },
    include: shiftInclude,
  });

  res.status(201).json(shift);
}

// POST /api/schedules/:scheduleId/shifts — nested create
export async function createNestedShift(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const scheduleId = req.params.scheduleId as string;
  const data = req.body as CreateNestedShiftInput;

  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, organizationId },
  });
  if (!schedule) throw new AppError(404, "Schedule not found");

  if (data.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId },
    });
    if (!employee) throw new AppError(404, "Employee not found");

    await checkOverlap(
      data.employeeId,
      new Date(data.startTime),
      new Date(data.endTime)
    );
  }

  const shift = await prisma.shift.create({
    data: {
      scheduleId,
      employeeId: data.employeeId ?? null,
      title: data.title,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      location: data.location,
      role: data.role,
      requiredHeadcount: data.requiredHeadcount ?? 1,
      notes: data.notes,
    },
    include: shiftInclude,
  });

  res.status(201).json(shift);
}

// GET /api/schedules/:scheduleId/shifts — nested list
export async function listScheduleShifts(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const scheduleId = req.params.scheduleId as string;

  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, organizationId },
  });
  if (!schedule) throw new AppError(404, "Schedule not found");

  const shifts = await prisma.shift.findMany({
    where: { scheduleId },
    include: shiftInclude,
    orderBy: { startTime: "asc" },
  });

  res.json(shifts);
}

export async function updateShift(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const data = req.body as UpdateShiftInput;

  const existing = await prisma.shift.findFirst({
    where: { id, schedule: { organizationId } },
  });
  if (!existing) throw new AppError(404, "Shift not found");

  if (data.employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId },
    });
    if (!employee) throw new AppError(404, "Employee not found");
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
  if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
  if (data.location !== undefined) updateData.location = data.location;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.requiredHeadcount !== undefined)
    updateData.requiredHeadcount = data.requiredHeadcount;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if ("employeeId" in data) updateData.employeeId = data.employeeId ?? null;

  const shift = await prisma.shift.update({
    where: { id },
    data: updateData,
    include: shiftInclude,
  });

  // Fire-and-forget: notify assigned employees of shift changes
  const changedFields = Object.keys(updateData).filter((k) => !["employeeId"].includes(k));
  if (changedFields.length > 0 && shift.assignments.length > 0) {
    const shiftDate = shift.startTime.toISOString().split("T")[0];
    const changes = changedFields.join(", ");
    const empEmails = shift.assignments
      .map((a) => a.employee)
      .filter((e): e is { id: string; firstName: string; lastName: string; position: string | null } => !!e);
    const empRecords = await prisma.employee.findMany({
      where: { id: { in: empEmails.map((e) => e.id) }, email: { not: null } },
      select: { email: true },
    });
    const userRecords = await prisma.user.findMany({
      where: { email: { in: empRecords.map((e) => e.email!).filter(Boolean) }, organizationId },
      select: { id: true, email: true },
    });
    notifyShiftUpdated(shift.title, shiftDate, changes, userRecords.map((u) => ({ userId: u.id, email: u.email }))).catch(() => {});
  }

  res.json(shift);
}

export async function deleteShift(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const existing = await prisma.shift.findFirst({
    where: { id, schedule: { organizationId } },
  });
  if (!existing) throw new AppError(404, "Shift not found");

  await prisma.shift.delete({ where: { id } });

  res.status(204).send();
}

// POST /api/shifts/:id/assign — assign one or more employees via ShiftAssignment
export async function assignEmployees(
  req: Request,
  res: Response
): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const { employeeIds } = req.body as AssignEmployeesInput;

  const shift = await prisma.shift.findFirst({
    where: { id, schedule: { organizationId } },
  });
  if (!shift) throw new AppError(404, "Shift not found");

  // Verify all employees belong to this org
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, organizationId },
    select: { id: true },
  });
  if (employees.length !== employeeIds.length) {
    throw new AppError(404, "One or more employees not found");
  }

  // Upsert assignments (ignore duplicates)
  await prisma.shiftAssignment.createMany({
    data: employeeIds.map((employeeId) => ({ shiftId: id, employeeId })),
    skipDuplicates: true,
  });

  const updated = await prisma.shift.findFirst({
    where: { id },
    include: shiftInclude,
  });

  // Fire-and-forget: notify assigned employees
  const shiftDate = shift.startTime.toISOString().split("T")[0];
  const assignedEmployees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, organizationId, email: { not: null } },
    select: { email: true },
  });
  const userRecords = await prisma.user.findMany({
    where: { email: { in: assignedEmployees.map((e) => e.email!).filter(Boolean) }, organizationId },
    select: { id: true, email: true },
  });
  notifyShiftAssigned(shift.title, shiftDate, userRecords.map((u) => ({ userId: u.id, email: u.email }))).catch(() => {});

  res.json(updated);
}

// DELETE /api/shifts/:id/employees/:eid — remove a ShiftAssignment
export async function removeAssignment(
  req: Request,
  res: Response
): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { id, eid } = req.params as { id: string; eid: string };

  const shift = await prisma.shift.findFirst({
    where: { id, schedule: { organizationId } },
  });
  if (!shift) throw new AppError(404, "Shift not found");

  const assignment = await prisma.shiftAssignment.findUnique({
    where: { shiftId_employeeId: { shiftId: id, employeeId: eid } },
  });
  if (!assignment) throw new AppError(404, "Assignment not found");

  await prisma.shiftAssignment.delete({
    where: { shiftId_employeeId: { shiftId: id, employeeId: eid } },
  });

  // Fire-and-forget: notify removed employee
  const removedEmp = await prisma.employee.findUnique({ where: { id: eid }, select: { email: true } });
  if (removedEmp?.email) {
    const removedUser = await prisma.user.findFirst({ where: { email: removedEmp.email, organizationId }, select: { id: true, email: true } });
    if (removedUser) {
      const shiftDate = shift.startTime.toISOString().split("T")[0];
      notifyShiftRemoved(shift.title, shiftDate, removedUser.id, removedUser.email).catch(() => {});
    }
  }

  res.status(204).send();
}

export async function getShiftConflicts(
  req: Request,
  res: Response
): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const { employeeId: queryEmployeeId } = req.query;

  const shift = await prisma.shift.findFirst({
    where: { id, schedule: { organizationId } },
    include: {
      assignments: { select: { employeeId: true } },
    },
  });
  if (!shift) throw new AppError(404, "Shift not found");

  // Determine which employees to check: query param, or all assigned via ShiftAssignment
  let empIdsToCheck: string[] = [];
  if (queryEmployeeId) {
    empIdsToCheck = [queryEmployeeId as string];
  } else {
    empIdsToCheck = shift.assignments.map((a) => a.employeeId);
    if (shift.employeeId && !empIdsToCheck.includes(shift.employeeId)) {
      empIdsToCheck.push(shift.employeeId);
    }
  }

  if (empIdsToCheck.length === 0) {
    res.json({ conflicts: [] });
    return;
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: empIdsToCheck }, organizationId },
    include: { availabilities: true },
  });

  const conflicts: Array<{
    employeeId: string;
    type: "double_booked" | "unavailable";
    conflictingShiftId?: string;
    message: string;
  }> = [];

  for (const employee of employees) {
    // Double-booking check
    const overlapping = await prisma.shift.findMany({
      where: {
        id: { not: id },
        startTime: { lt: shift.endTime },
        endTime: { gt: shift.startTime },
        OR: [
          { employeeId: employee.id },
          { assignments: { some: { employeeId: employee.id } } },
        ],
      },
      select: { id: true, title: true, schedule: { select: { name: true } } },
    });

    for (const other of overlapping) {
      conflicts.push({
        employeeId: employee.id,
        type: "double_booked",
        conflictingShiftId: other.id,
        message: `${employee.firstName} ${employee.lastName} is double-booked with "${other.title}" (${other.schedule.name})`,
      });
    }

    // Availability check
    const shiftDay = shift.startTime.getDay();
    const isUnavailable = employee.availabilities.some(
      (a) => a.dayOfWeek === shiftDay && a.type === "UNAVAILABLE"
    );

    if (isUnavailable) {
      conflicts.push({
        employeeId: employee.id,
        type: "unavailable",
        message: `${employee.firstName} ${employee.lastName} is marked unavailable on this day`,
      });
    }
  }

  res.json({ conflicts });
}
