import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule";

export async function listSchedules(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;

  const schedules = await prisma.schedule.findMany({
    where: { organizationId },
    orderBy: { startDate: "desc" },
  });

  res.json(schedules);
}

export async function getSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const schedule = await prisma.schedule.findFirst({
    where: { id, organizationId },
    include: { shifts: { include: { employee: true } } },
  });

  if (!schedule) {
    throw new AppError(404, "Schedule not found");
  }

  res.json(schedule);
}

export async function createSchedule(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const data = req.body as CreateScheduleInput;

  const schedule = await prisma.schedule.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status || "DRAFT",
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

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
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
