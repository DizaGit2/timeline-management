/**
 * TIM-55 — Shift conflict detection tests
 *
 * Tests GET /api/shifts/:id/conflicts for double-booking and
 * availability conflict detection.
 */
import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

async function createOrg() {
  return prisma.organization.create({
    data: { name: `Conflict Test Org ${Date.now()}`, ownerUserId: "test-owner" },
  });
}

async function createManager(orgId: string) {
  const bcrypt = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email: `conflict-mgr-${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash("password", 1),
      name: "Conflict Manager",
      role: "MANAGER",
      organizationId: orgId,
    },
  });
}

async function loginAs(email: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password" });
  return res.body.accessToken as string;
}

async function createEmployee(orgId: string, name = "Test") {
  return prisma.employee.create({
    data: { firstName: name, lastName: "Employee", organizationId: orgId },
  });
}

async function createSchedule(orgId: string) {
  return prisma.schedule.create({
    data: {
      name: "Conflict Test Schedule",
      startDate: new Date("2026-04-06"),
      endDate: new Date("2026-04-12"),
      status: "PUBLISHED",
      organizationId: orgId,
    },
  });
}

describe("GET /api/shifts/:id/conflicts", () => {
  let orgId: string;
  let token: string;
  let scheduleId: string;
  let employeeId: string;

  beforeAll(async () => {
    const org = await createOrg();
    orgId = org.id;
    const manager = await createManager(orgId);
    token = await loginAs(manager.email);
    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
    const employee = await createEmployee(orgId, "Alice");
    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.shiftAssignment.deleteMany({
      where: { shift: { scheduleId } },
    });
    await prisma.shift.deleteMany({ where: { scheduleId } });
    await prisma.availability.deleteMany({
      where: { employee: { organizationId: orgId } },
    });
  });

  it("returns 401 when not authenticated", async () => {
    const shift = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Auth Test",
        startTime: new Date("2026-04-07T08:00:00Z"),
        endTime: new Date("2026-04-07T16:00:00Z"),
      },
    });

    const res = await request(app).get(`/api/shifts/${shift.id}/conflicts`);
    expect(res.status).toBe(401);
  });

  it("returns empty conflicts when no employees are assigned", async () => {
    const shift = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Empty Shift",
        startTime: new Date("2026-04-07T08:00:00Z"),
        endTime: new Date("2026-04-07T16:00:00Z"),
      },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift.id}/conflicts`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
  });

  it("detects double-booking when employee has overlapping shift via assignment", async () => {
    // Create two overlapping shifts
    const shift1 = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Morning Shift",
        startTime: new Date("2026-04-07T08:00:00Z"),
        endTime: new Date("2026-04-07T16:00:00Z"),
      },
    });

    const shift2 = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Overlapping Shift",
        startTime: new Date("2026-04-07T12:00:00Z"),
        endTime: new Date("2026-04-07T20:00:00Z"),
      },
    });

    // Assign employee to both
    await prisma.shiftAssignment.create({
      data: { shiftId: shift1.id, employeeId },
    });
    await prisma.shiftAssignment.create({
      data: { shiftId: shift2.id, employeeId },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift1.id}/conflicts`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0]).toMatchObject({
      employeeId,
      type: "double_booked",
      conflictingShiftId: shift2.id,
    });
  });

  it("detects double-booking when employee is assigned via employeeId field", async () => {
    const shift1 = await prisma.shift.create({
      data: {
        scheduleId,
        employeeId,
        title: "Direct Assigned",
        startTime: new Date("2026-04-08T08:00:00Z"),
        endTime: new Date("2026-04-08T16:00:00Z"),
      },
    });

    await prisma.shift.create({
      data: {
        scheduleId,
        employeeId,
        title: "Overlapping Direct",
        startTime: new Date("2026-04-08T14:00:00Z"),
        endTime: new Date("2026-04-08T22:00:00Z"),
      },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift1.id}/conflicts?employeeId=${employeeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts.some(
      (c: { type: string }) => c.type === "double_booked"
    )).toBe(true);
  });

  it("does not flag non-overlapping shifts as conflicts", async () => {
    const shift1 = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Morning",
        startTime: new Date("2026-04-09T06:00:00Z"),
        endTime: new Date("2026-04-09T14:00:00Z"),
      },
    });

    await prisma.shift.create({
      data: {
        scheduleId,
        title: "Evening",
        startTime: new Date("2026-04-09T14:00:00Z"),
        endTime: new Date("2026-04-09T22:00:00Z"),
      },
    });

    await prisma.shiftAssignment.create({
      data: { shiftId: shift1.id, employeeId },
    });

    // Assign to second shift too
    const shift2 = await prisma.shift.findFirst({
      where: { title: "Evening", scheduleId },
    });
    await prisma.shiftAssignment.create({
      data: { shiftId: shift2!.id, employeeId },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift1.id}/conflicts`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Back-to-back shifts (end of one = start of another) should not conflict
    expect(
      res.body.conflicts.filter((c: { type: string }) => c.type === "double_booked")
    ).toHaveLength(0);
  });

  it("detects unavailability conflict when employee is marked UNAVAILABLE on shift day", async () => {
    const shift = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Tuesday Shift",
        startTime: new Date("2026-04-07T08:00:00Z"), // Tuesday (day 2)
        endTime: new Date("2026-04-07T16:00:00Z"),
      },
    });

    await prisma.shiftAssignment.create({
      data: { shiftId: shift.id, employeeId },
    });

    // Mark employee as unavailable on Tuesday (dayOfWeek = 2)
    await prisma.availability.create({
      data: {
        employeeId,
        dayOfWeek: 2, // Tuesday
        startTime: "00:00",
        endTime: "23:59",
        type: "UNAVAILABLE",
      },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift.id}/conflicts`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts.some(
      (c: { type: string }) => c.type === "unavailable"
    )).toBe(true);
  });

  it("does not flag AVAILABLE availability as a conflict", async () => {
    const shift = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Wednesday Shift",
        startTime: new Date("2026-04-08T08:00:00Z"), // Wednesday (day 3)
        endTime: new Date("2026-04-08T16:00:00Z"),
      },
    });

    await prisma.shiftAssignment.create({
      data: { shiftId: shift.id, employeeId },
    });

    await prisma.availability.create({
      data: {
        employeeId,
        dayOfWeek: 3, // Wednesday
        startTime: "08:00",
        endTime: "16:00",
        type: "AVAILABLE",
      },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift.id}/conflicts`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(
      res.body.conflicts.filter((c: { type: string }) => c.type === "unavailable")
    ).toHaveLength(0);
  });

  it("checks conflicts for a specific employee via query param", async () => {
    const emp2 = await createEmployee(orgId, "Bob");

    const shift = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Query Param Test",
        startTime: new Date("2026-04-10T08:00:00Z"),
        endTime: new Date("2026-04-10T16:00:00Z"),
      },
    });

    // Create overlapping shift assigned to emp2 only
    const overlap = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Overlap for Bob",
        startTime: new Date("2026-04-10T10:00:00Z"),
        endTime: new Date("2026-04-10T18:00:00Z"),
      },
    });

    await prisma.shiftAssignment.create({
      data: { shiftId: overlap.id, employeeId: emp2.id },
    });

    // Query conflicts for emp2 specifically on the first shift
    const res = await request(app)
      .get(`/api/shifts/${shift.id}/conflicts?employeeId=${emp2.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0].employeeId).toBe(emp2.id);
    expect(res.body.conflicts[0].type).toBe("double_booked");
  });

  it("returns 404 for non-existent shift", async () => {
    const res = await request(app)
      .get("/api/shifts/00000000-0000-0000-0000-000000000000/conflicts")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("detects both double-booking and unavailability for the same employee", async () => {
    const shift1 = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Both Conflicts",
        startTime: new Date("2026-04-07T08:00:00Z"), // Tuesday
        endTime: new Date("2026-04-07T16:00:00Z"),
      },
    });

    const shift2 = await prisma.shift.create({
      data: {
        scheduleId,
        title: "Overlapper",
        startTime: new Date("2026-04-07T12:00:00Z"),
        endTime: new Date("2026-04-07T20:00:00Z"),
      },
    });

    await prisma.shiftAssignment.create({
      data: { shiftId: shift1.id, employeeId },
    });
    await prisma.shiftAssignment.create({
      data: { shiftId: shift2.id, employeeId },
    });

    // Also mark Tuesday as unavailable
    await prisma.availability.create({
      data: {
        employeeId,
        dayOfWeek: 2,
        startTime: "00:00",
        endTime: "23:59",
        type: "UNAVAILABLE",
      },
    });

    const res = await request(app)
      .get(`/api/shifts/${shift1.id}/conflicts`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const types = res.body.conflicts.map((c: { type: string }) => c.type);
    expect(types).toContain("double_booked");
    expect(types).toContain("unavailable");
  });
});
