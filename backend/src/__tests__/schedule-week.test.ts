/**
 * TIM-72 — Visual Schedule Builder QA
 * Backend API tests: GET /api/shifts/week
 *
 * Tests the week-view endpoint that returns all shifts for a 7-day window.
 * Depends on TIM-48 (week-view endpoint implementation).
 */
import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

// Test data helpers
async function createOrg() {
  return prisma.organization.create({
    data: { name: "Test Org", ownerUserId: "test-owner" },
  });
}

async function createManager(orgId: string) {
  const bcrypt = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email: `manager-${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash("password", 1),
      name: "Test Manager",
      role: "MANAGER",
      organizationId: orgId,
    },
  });
}

async function loginAs(email: string, password = "password") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.body.accessToken as string;
}

async function createEmployee(orgId: string, overrides: Record<string, unknown> = {}) {
  return prisma.employee.create({
    data: {
      firstName: "Test",
      lastName: "Employee",
      organizationId: orgId,
      ...overrides,
    },
  });
}

async function createSchedule(orgId: string) {
  return prisma.schedule.create({
    data: {
      name: "Week Test",
      startDate: new Date("2026-04-06"),
      endDate: new Date("2026-04-12"),
      status: "PUBLISHED",
      organizationId: orgId,
    },
  });
}

async function createShift(
  scheduleId: string,
  employeeId: string | null,
  day: string,
  overrides: Record<string, unknown> = {}
) {
  return prisma.shift.create({
    data: {
      scheduleId,
      employeeId,
      title: "Test Shift",
      startTime: new Date(`${day}T08:00:00.000Z`),
      endTime: new Date(`${day}T16:00:00.000Z`),
      ...overrides,
    },
  });
}

describe("GET /api/shifts/week", () => {
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
    const employee = await createEmployee(orgId);
    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean shifts between tests
    await prisma.shift.deleteMany({ where: { scheduleId } });
  });

  it("returns 400 when start param is missing", async () => {
    const res = await request(app)
      .get("/api/shifts/week")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/start/i) });
  });

  it("returns 400 when start param is not a valid date", async () => {
    const res = await request(app)
      .get("/api/shifts/week?start=not-a-date")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/shifts/week?start=2026-04-06");
    expect(res.status).toBe(401);
  });

  it("returns an empty array when no shifts exist for the week", async () => {
    const res = await request(app)
      .get("/api/shifts/week?start=2026-04-06")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all shifts within the 7-day window starting from start date", async () => {
    await Promise.all([
      createShift(scheduleId, employeeId, "2026-04-06"), // Mon — in range
      createShift(scheduleId, employeeId, "2026-04-09"), // Thu — in range
      createShift(scheduleId, employeeId, "2026-04-12"), // Sun — last day, in range
    ]);

    const res = await request(app)
      .get("/api/shifts/week?start=2026-04-06")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it("does not return shifts outside the 7-day window", async () => {
    await createShift(scheduleId, employeeId, "2026-04-05"); // day before window
    await createShift(scheduleId, employeeId, "2026-04-13"); // day after window
    await createShift(scheduleId, employeeId, "2026-04-08"); // within window

    const res = await request(app)
      .get("/api/shifts/week?start=2026-04-06")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].startTime).toContain("2026-04-08");
  });

  it("does not return shifts from a different organization", async () => {
    const otherOrg = await createOrg();
    const otherSchedule = await createSchedule(otherOrg.id);
    await createShift(otherSchedule.id, null, "2026-04-07");

    const res = await request(app)
      .get("/api/shifts/week?start=2026-04-06")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("includes employee details in each shift", async () => {
    await createShift(scheduleId, employeeId, "2026-04-07");

    const res = await request(app)
      .get("/api/shifts/week?start=2026-04-06")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      employee: expect.objectContaining({ id: employeeId }),
    });
  });

  it("returns shifts sorted by startTime ascending", async () => {
    await createShift(scheduleId, employeeId, "2026-04-10");
    await createShift(scheduleId, employeeId, "2026-04-07");
    await createShift(scheduleId, employeeId, "2026-04-09");

    const res = await request(app)
      .get("/api/shifts/week?start=2026-04-06")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const times: string[] = res.body.map((s: { startTime: string }) => s.startTime);
    expect(times).toEqual([...times].sort());
  });
});
