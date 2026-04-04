import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { CreateEmployeeInput, UpdateEmployeeInput } from "../validators/employee";

export async function listEmployees(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const includeInactive = req.query.includeInactive === "true";
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;

  // Status filter: "active", "inactive", or omitted (defaults based on includeInactive)
  let isActiveFilter: boolean | undefined;
  if (status === "active") {
    isActiveFilter = true;
  } else if (status === "inactive") {
    isActiveFilter = false;
  } else if (!includeInactive) {
    isActiveFilter = true;
  }

  const employees = await prisma.employee.findMany({
    where: {
      organizationId,
      ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(employees);
}

export async function listInactiveEmployees(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;

  const employees = await prisma.employee.findMany({
    where: { organizationId, isActive: false },
    orderBy: { createdAt: "desc" },
  });

  res.json(employees);
}

export async function getEmployee(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const employee = await prisma.employee.findFirst({
    where: { id, organizationId },
    include: { shifts: true, availabilities: true },
  });

  if (!employee) {
    throw new AppError(404, "Employee not found");
  }

  res.json(employee);
}

export async function createEmployee(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const data = req.body as CreateEmployeeInput;

  const employee = await prisma.employee.create({
    data: { ...data, organizationId },
  });

  res.status(201).json(employee);
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;
  const data = req.body as UpdateEmployeeInput;

  const existing = await prisma.employee.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Employee not found");
  }

  const employee = await prisma.employee.update({
    where: { id },
    data,
  });

  res.json(employee);
}

export async function deleteEmployee(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const existing = await prisma.employee.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Employee not found");
  }

  // Soft delete: set isActive to false
  await prisma.employee.update({
    where: { id },
    data: { isActive: false },
  });

  res.status(204).send();
}

export async function reactivateEmployee(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const id = req.params.id as string;

  const existing = await prisma.employee.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    throw new AppError(404, "Employee not found");
  }

  if (existing.isActive) {
    throw new AppError(400, "Employee is already active");
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: { isActive: true },
  });

  res.json(employee);
}
