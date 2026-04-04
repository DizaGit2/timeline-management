import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

function parseWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function hoursFromShift(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
}

export async function hoursReport(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { weekStart } = req.query;

  if (!weekStart || typeof weekStart !== "string") {
    throw new AppError(400, "weekStart query parameter is required (YYYY-MM-DD)");
  }

  const { start, end } = parseWeekRange(weekStart);

  // Get all shifts in the week for this org, with assignments
  const shifts = await prisma.shift.findMany({
    where: {
      schedule: { organizationId },
      startTime: { gte: start, lt: end },
    },
    include: {
      assignments: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Aggregate hours per employee
  const employeeHours = new Map<string, { name: string; totalHours: number; shiftCount: number }>();

  for (const shift of shifts) {
    const hours = hoursFromShift(shift.startTime, shift.endTime);

    // Count via ShiftAssignment
    for (const assignment of shift.assignments) {
      const emp = assignment.employee;
      const existing = employeeHours.get(emp.id) || {
        name: `${emp.firstName} ${emp.lastName}`,
        totalHours: 0,
        shiftCount: 0,
      };
      existing.totalHours += hours;
      existing.shiftCount += 1;
      employeeHours.set(emp.id, existing);
    }

    // Also count legacy direct employeeId (if not already counted via assignment)
    if (shift.employee && !shift.assignments.some((a) => a.employeeId === shift.employee!.id)) {
      const emp = shift.employee;
      const existing = employeeHours.get(emp.id) || {
        name: `${emp.firstName} ${emp.lastName}`,
        totalHours: 0,
        shiftCount: 0,
      };
      existing.totalHours += hours;
      existing.shiftCount += 1;
      employeeHours.set(emp.id, existing);
    }
  }

  const result = Array.from(employeeHours.entries()).map(([employeeId, data]) => ({
    employeeId,
    employeeName: data.name,
    totalHours: Math.round(data.totalHours * 100) / 100,
    shiftCount: data.shiftCount,
  }));

  result.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  res.json(result);
}

export async function unfilledReport(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { weekStart } = req.query;

  if (!weekStart || typeof weekStart !== "string") {
    throw new AppError(400, "weekStart query parameter is required (YYYY-MM-DD)");
  }

  const { start, end } = parseWeekRange(weekStart);

  const shifts = await prisma.shift.findMany({
    where: {
      schedule: { organizationId },
      startTime: { gte: start, lt: end },
    },
    include: {
      assignments: true,
    },
    orderBy: { startTime: "asc" },
  });

  const unfilled = shifts
    .filter((shift) => shift.assignments.length < shift.requiredHeadcount)
    .map((shift) => ({
      shiftId: shift.id,
      title: shift.title,
      date: shift.startTime.toISOString().split("T")[0],
      required: shift.requiredHeadcount,
      assigned: shift.assignments.length,
    }));

  res.json(unfilled);
}

export async function scheduleCsv(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const { weekStart } = req.query;

  if (!weekStart || typeof weekStart !== "string") {
    throw new AppError(400, "weekStart query parameter is required (YYYY-MM-DD)");
  }

  const { start, end } = parseWeekRange(weekStart);

  const shifts = await prisma.shift.findMany({
    where: {
      schedule: { organizationId },
      startTime: { gte: start, lt: end },
    },
    include: {
      assignments: {
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const rows: string[] = ["Employee,Shift Title,Date,Start Time,End Time,Hours,Location"];

  for (const shift of shifts) {
    const date = shift.startTime.toISOString().split("T")[0];
    const startStr = shift.startTime.toISOString().split("T")[1].substring(0, 5);
    const endStr = shift.endTime.toISOString().split("T")[1].substring(0, 5);
    const hours = hoursFromShift(shift.startTime, shift.endTime).toFixed(2);
    const location = shift.location || "";

    // Collect all assigned employees
    const employees: string[] = [];
    for (const assignment of shift.assignments) {
      employees.push(`${assignment.employee.firstName} ${assignment.employee.lastName}`);
    }
    if (shift.employee && !employees.some((name) => name === `${shift.employee!.firstName} ${shift.employee!.lastName}`)) {
      employees.push(`${shift.employee.firstName} ${shift.employee.lastName}`);
    }

    if (employees.length === 0) {
      employees.push("Unassigned");
    }

    for (const empName of employees) {
      // Escape CSV fields that might contain commas
      const escapeCsv = (s: string) => (s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s);
      rows.push(
        [escapeCsv(empName), escapeCsv(shift.title), date, startStr, endStr, hours, escapeCsv(location)].join(",")
      );
    }
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="schedule-${weekStart}.csv"`);
  res.send(rows.join("\n"));
}
