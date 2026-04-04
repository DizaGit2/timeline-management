import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { CreateEmployeeInput, UpdateEmployeeInput } from "../validators/employee";

export async function listEmployees(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;

  const employees = await prisma.employee.findMany({
    where: { organizationId },
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

  await prisma.employee.delete({ where: { id } });

  res.status(204).send();
}
