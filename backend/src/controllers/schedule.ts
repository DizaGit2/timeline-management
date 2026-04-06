import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { CreateScheduleInput, UpdateScheduleInput, CopyWeekInput } from "../validators/schedule";

export async function listSchedules(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;

  const schedules = await prisma.schedule.findMany({
    where: { organizationId },
    include: { team: true },
    orderBy: { startDate: "desc" },
  });

  res.json(schedules);
}

export async function getSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const schedule = await prisma.schedule.findFirst({
    where: { id, organizationId },
    include: {
      team: true,
      shifts: {
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!schedule) {
    throw new AppError(404, "Schedule not found");
  }

  res.json(schedule);
}

export async function createSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const data = req.body as CreateScheduleInput;

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end <= start) {
    throw new AppError(400, "endDate must be after startDate");
  }

  if (data.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: data.teamId, organizationId },
    });
    if (!team) {
      throw new AppError(404, "Team not found");
    }
  }

  const schedule = await prisma.schedule.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      location: data.location,
      teamId: data.teamId,
      status: "DRAFT",
      organizationId,
    },
  });

  res.status(201).json(schedule);
}

export async function updateSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const data = req.body as UpdateScheduleInput;

  const existing = await prisma.schedule.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Schedule not found");
  }

  if (data.teamId !== undefined) {
    if (data.teamId !== null) {
      const team = await prisma.team.findFirst({
        where: { id: data.teamId, organizationId },
      });
      if (!team) {
        throw new AppError(404, "Team not found");
      }
    }
  }

  // Validate date range when either date is provided
  const effectiveStart = data.startDate ? new Date(data.startDate) : existing.startDate;
  const effectiveEnd = data.endDate ? new Date(data.endDate) : existing.endDate;
  if (effectiveEnd <= effectiveStart) {
    throw new AppError(400, "endDate must be after startDate");
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.location !== undefined) updateData.location = data.location;
  if (data.teamId !== undefined) updateData.teamId = data.teamId;
  if (data.status !== undefined) updateData.status = data.status;

  const schedule = await prisma.schedule.update({
    where: { id },
    data: updateData,
  });

  res.json(schedule);
}

export async function deleteSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const existing = await prisma.schedule.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Schedule not found");
  }

  await prisma.schedule.delete({ where: { id } });

  res.status(204).send();
}

export async function publishSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const existing = await prisma.schedule.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Schedule not found");
  }

  if (existing.status !== "DRAFT") {
    throw new AppError(400, "Only DRAFT schedules can be published");
  }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: { status: "PUBLISHED" },
  });

  res.json(schedule);
}

export async function getShiftCount(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const existing = await prisma.schedule.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Schedule not found");
  }

  const shiftCount = await prisma.shift.count({
    where: { scheduleId: id },
  });

  res.json({ scheduleId: id, shiftCount });
}

export async function copyWeek(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { sourceWeekStart, targetWeekStart } = req.body as CopyWeekInput;

  if (sourceWeekStart === targetWeekStart) {
    throw new AppError(400, "Cannot copy to the same week");
  }

  const sourceStart = new Date(`${sourceWeekStart}T00:00:00.000Z`);
  const sourceEnd = new Date(sourceStart);
  sourceEnd.setUTCDate(sourceEnd.getUTCDate() + 7);

  const targetStart = new Date(`${targetWeekStart}T00:00:00.000Z`);
  const targetEnd = new Date(targetStart);
  targetEnd.setUTCDate(targetEnd.getUTCDate() + 7);

  // Calculate offset in milliseconds between source and target weeks
  const offsetMs = targetStart.getTime() - sourceStart.getTime();

  // Find all shifts in the source week for this org
  const sourceShifts = await prisma.shift.findMany({
    where: {
      schedule: { organizationId },
      startTime: { gte: sourceStart, lt: sourceEnd },
    },
  });

  if (sourceShifts.length === 0) {
    throw new AppError(404, "No shifts found in source week");
  }

  // Check if target week already has shifts
  const existingTargetShifts = await prisma.shift.findMany({
    where: {
      schedule: { organizationId },
      startTime: { gte: targetStart, lt: targetEnd },
    },
    take: 1,
  });

  if (existingTargetShifts.length > 0) {
    throw new AppError(409, "Target week already has shifts");
  }

  // Create copies with offset dates
  const copiedShifts = await Promise.all(
    sourceShifts.map((shift) =>
      prisma.shift.create({
        data: {
          scheduleId: shift.scheduleId,
          employeeId: shift.employeeId,
          title: shift.title,
          startTime: new Date(shift.startTime.getTime() + offsetMs),
          endTime: new Date(shift.endTime.getTime() + offsetMs),
          location: shift.location,
          role: shift.role,
          requiredHeadcount: shift.requiredHeadcount,
          notes: shift.notes,
        },
      })
    )
  );

  res.status(201).json({ shifts: copiedShifts });
}
