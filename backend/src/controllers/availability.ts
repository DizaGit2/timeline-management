import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AvailabilityWindowInput, CreateUnavailabilityInput } from "../validators/availability";

export async function getAvailability(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const employeeId = req.params.id as string;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
  });
  if (!employee) throw new AppError(404, "Employee not found");

  const availabilities = await prisma.availability.findMany({
    where: { employeeId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  res.json(availabilities);
}

export async function replaceAvailability(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const employeeId = req.params.id as string;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
  });
  if (!employee) throw new AppError(404, "Employee not found");

  const windows = req.body as AvailabilityWindowInput[];

  // Replace all existing availability windows in a transaction
  const result = await prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({ where: { employeeId } });

    if (windows.length === 0) return [];

    await tx.availability.createMany({
      data: windows.map((w) => ({
        employeeId,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        type: w.type || "AVAILABLE",
      })),
    });

    return tx.availability.findMany({
      where: { employeeId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  });

  res.json(result);
}

export async function listUnavailability(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const employeeId = req.params.id as string;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
  });
  if (!employee) throw new AppError(404, "Employee not found");

  const exceptions = await prisma.unavailabilityException.findMany({
    where: { employeeId },
    orderBy: { date: "asc" },
  });

  res.json(exceptions);
}

export async function createUnavailability(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const employeeId = req.params.id as string;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
  });
  if (!employee) throw new AppError(404, "Employee not found");

  const data = req.body as CreateUnavailabilityInput;

  const exception = await prisma.unavailabilityException.create({
    data: {
      employeeId,
      date: new Date(data.date),
      reason: data.reason,
    },
  });

  res.status(201).json(exception);
}

export async function deleteUnavailability(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const employeeId = req.params.id as string;
  const exceptionId = req.params.eid as string;

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
  });
  if (!employee) throw new AppError(404, "Employee not found");

  const exception = await prisma.unavailabilityException.findFirst({
    where: { id: exceptionId, employeeId },
  });
  if (!exception) throw new AppError(404, "Unavailability exception not found");

  await prisma.unavailabilityException.delete({ where: { id: exceptionId } });

  res.status(204).send();
}

export async function weekAvailabilitySummary(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { start } = req.query;

  if (!start || typeof start !== "string") {
    throw new AppError(400, "start query parameter is required (YYYY-MM-DD)");
  }

  const weekStart = new Date(`${start}T00:00:00.000Z`);
  if (isNaN(weekStart.getTime())) {
    throw new AppError(400, "start must be a valid date in YYYY-MM-DD format");
  }
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const employees = await prisma.employee.findMany({
    where: { organizationId, isActive: true },
    orderBy: { lastName: "asc" },
  });

  const summary = await Promise.all(
    employees.map(async (emp) => {
      const availabilities = await prisma.availability.findMany({
        where: { employeeId: emp.id },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
      return {
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        recurringWindows: availabilities,
        exceptions: [],
      };
    })
  );

  res.json(summary);
}
