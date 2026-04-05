import { Request, Response } from "express";
import prisma from "../lib/prisma";

function getUtcWeekMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;

  const weekMonday = getUtcWeekMonday();
  const weekEnd = new Date(weekMonday);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [scheduleCount, employeeCount, shiftsThisWeek] = await Promise.all([
    prisma.schedule.count({ where: { organizationId } }),
    prisma.employee.count({ where: { organizationId, isActive: true } }),
    prisma.shift.findMany({
      where: {
        schedule: { organizationId },
        startTime: { gte: weekMonday, lt: weekEnd },
      },
      include: { assignments: true },
    }),
  ]);

  const unfilledShiftsThisWeek = shiftsThisWeek.filter(
    (shift) => shift.requiredHeadcount > 0 && shift.assignments.length < shift.requiredHeadcount
  ).length;

  res.json({
    scheduleCount,
    employeeCount,
    shiftsThisWeek: shiftsThisWeek.length,
    unfilledShiftsThisWeek,
  });
}
