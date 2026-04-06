import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { SyncClockEventsInput, ClockInOutInput } from "../validators/clock";

/**
 * Resolve the Employee record for the current user based on email match.
 */
async function resolveEmployee(userId: string, organizationId: string) {
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

/**
 * Process a single clock event: idempotency check, create TimeEntry, update ClockEvent status.
 */
async function processClockEvent(
  event: {
    type: "CLOCK_IN" | "CLOCK_OUT";
    clientTimestamp: string;
    idempotencyKey: string;
    shiftId?: string;
    notes?: string;
  },
  employeeId: string,
  organizationId: string,
  source: string
): Promise<{
  idempotencyKey: string;
  status: "PROCESSED" | "DUPLICATE" | "ERROR";
  timeEntryId?: string;
  error?: string;
}> {
  // Check for duplicate idempotency key in TimeEntry
  const existingEntry = await prisma.timeEntry.findUnique({
    where: { idempotencyKey: event.idempotencyKey },
    select: { id: true },
  });

  if (existingEntry) {
    // Mark ClockEvent as duplicate if it exists
    await prisma.clockEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      update: { status: "DUPLICATE", processedAt: new Date() },
      create: {
        employeeId,
        organizationId,
        type: event.type,
        clientTimestamp: new Date(event.clientTimestamp),
        idempotencyKey: event.idempotencyKey,
        status: "DUPLICATE",
        timeEntryId: existingEntry.id,
        processedAt: new Date(),
      },
    });

    return {
      idempotencyKey: event.idempotencyKey,
      status: "DUPLICATE",
      timeEntryId: existingEntry.id,
    };
  }

  try {
    // Create the TimeEntry
    const timeEntry = await prisma.timeEntry.create({
      data: {
        employeeId,
        organizationId,
        type: event.type,
        timestamp: new Date(event.clientTimestamp),
        shiftId: event.shiftId ?? null,
        notes: event.notes ?? null,
        source,
        idempotencyKey: event.idempotencyKey,
      },
    });

    // Upsert the ClockEvent record
    await prisma.clockEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      update: {
        status: "PROCESSED",
        timeEntryId: timeEntry.id,
        processedAt: new Date(),
      },
      create: {
        employeeId,
        organizationId,
        type: event.type,
        clientTimestamp: new Date(event.clientTimestamp),
        idempotencyKey: event.idempotencyKey,
        status: "PROCESSED",
        timeEntryId: timeEntry.id,
        processedAt: new Date(),
      },
    });

    return {
      idempotencyKey: event.idempotencyKey,
      status: "PROCESSED",
      timeEntryId: timeEntry.id,
    };
  } catch (err: unknown) {
    // Handle unique constraint violation on idempotencyKey (race condition)
    const prismaErr = err as { code?: string };
    if (prismaErr.code === "P2002") {
      const existing = await prisma.timeEntry.findUnique({
        where: { idempotencyKey: event.idempotencyKey },
        select: { id: true },
      });
      return {
        idempotencyKey: event.idempotencyKey,
        status: "DUPLICATE",
        timeEntryId: existing?.id,
      };
    }

    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    await prisma.clockEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      update: { status: "ERROR", errorMessage: errorMsg, processedAt: new Date() },
      create: {
        employeeId,
        organizationId,
        type: event.type,
        clientTimestamp: new Date(event.clientTimestamp),
        idempotencyKey: event.idempotencyKey,
        status: "ERROR",
        errorMessage: errorMsg,
        processedAt: new Date(),
      },
    });

    return {
      idempotencyKey: event.idempotencyKey,
      status: "ERROR",
      error: errorMsg,
    };
  }
}

/**
 * POST /api/clock/sync — Process a batch of offline clock events.
 * Accepts an array of events with idempotency keys.
 * Returns per-event status so the client knows which to clear from its local queue.
 */
export async function syncClockEvents(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const userId = req.user!.userId;
  const { events } = req.body as SyncClockEventsInput;

  const employee = await resolveEmployee(userId, organizationId);
  if (!employee) {
    throw new AppError(404, "No employee record found for current user");
  }

  // Sort events by clientTimestamp to process in chronological order
  const sorted = [...events].sort(
    (a, b) => new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime()
  );

  const results = [];
  for (const event of sorted) {
    const result = await processClockEvent(
      event,
      employee.id,
      organizationId,
      "mobile"
    );
    results.push(result);
  }

  const processed = results.filter((r) => r.status === "PROCESSED").length;
  const duplicates = results.filter((r) => r.status === "DUPLICATE").length;
  const errors = results.filter((r) => r.status === "ERROR").length;

  res.json({
    syncedAt: new Date().toISOString(),
    summary: { total: results.length, processed, duplicates, errors },
    results,
  });
}

/**
 * POST /api/clock — Single clock-in or clock-out (real-time, non-batched).
 */
export async function clockInOut(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const userId = req.user!.userId;
  const data = req.body as ClockInOutInput;

  const employee = await resolveEmployee(userId, organizationId);
  if (!employee) {
    throw new AppError(404, "No employee record found for current user");
  }

  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  const result = await processClockEvent(
    {
      type: data.type,
      clientTimestamp: timestamp.toISOString(),
      idempotencyKey: data.idempotencyKey,
      shiftId: data.shiftId,
      notes: data.notes,
    },
    employee.id,
    organizationId,
    "web"
  );

  if (result.status === "ERROR") {
    throw new AppError(500, result.error || "Failed to process clock event");
  }

  const statusCode = result.status === "DUPLICATE" ? 200 : 201;
  res.status(statusCode).json(result);
}

/**
 * GET /api/clock/status — Get current clock status for the authenticated employee.
 * Returns the most recent time entry to help the client know if employee is clocked in or out.
 */
export async function getClockStatus(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const userId = req.user!.userId;

  const employee = await resolveEmployee(userId, organizationId);
  if (!employee) {
    throw new AppError(404, "No employee record found for current user");
  }

  const latestEntry = await prisma.timeEntry.findFirst({
    where: { employeeId: employee.id, organizationId },
    orderBy: { timestamp: "desc" },
    select: {
      id: true,
      type: true,
      timestamp: true,
      shiftId: true,
      source: true,
      createdAt: true,
    },
  });

  res.json({
    employeeId: employee.id,
    isClockedIn: latestEntry?.type === "CLOCK_IN",
    lastEntry: latestEntry ?? null,
  });
}

/**
 * GET /api/clock/entries — List time entries for the authenticated employee.
 * Supports optional from/to date filters.
 */
export async function listTimeEntries(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;
  const userId = req.user!.userId;
  const { from, to, employeeId: queryEmployeeId } = req.query;

  // Managers/Admins can query any employee; employees can only see their own
  let targetEmployeeId: string;
  if (queryEmployeeId && req.user!.role !== "EMPLOYEE") {
    targetEmployeeId = queryEmployeeId as string;
  } else {
    const employee = await resolveEmployee(userId, organizationId);
    if (!employee) {
      throw new AppError(404, "No employee record found for current user");
    }
    targetEmployeeId = employee.id;
  }

  const entries = await prisma.timeEntry.findMany({
    where: {
      employeeId: targetEmployeeId,
      organizationId,
      ...(from || to
        ? {
            timestamp: {
              ...(from ? { gte: new Date(from as string) } : {}),
              ...(to ? { lte: new Date(to as string) } : {}),
            },
          }
        : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  res.json(entries);
}

/**
 * GET /api/clock/pending — Manager endpoint: list pending/errored clock events for the org.
 */
export async function listPendingEvents(req: Request, res: Response): Promise<void> {
  const organizationId = req.user!.organizationId;

  const events = await prisma.clockEvent.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "ERROR"] },
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  res.json(events);
}
