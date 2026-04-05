/**
 * TIM-72 — Visual Schedule Builder QA
 * Backend API tests: POST /api/schedules/copy-week
 *
 * Tests the copy-week endpoint that duplicates all shifts from a source week
 * to a target week. Depends on TIM-48 (copy-week endpoint implementation).
 */
import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

async function createOrg() {
  return prisma.organization.create({
    data: { name: "CopyWeek Test Org", ownerUserId: "test-owner" },
  });
}

async function createManager(orgId: string) {
  const bcrypt = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email: `mgr-cw-${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash("password", 1),
      name: "Copy Week Manager",
      role: "MANAGER",
      organizationId: orgId,
    },
  });
}

async function loginAs(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: "password" });
  return res.body.accessToken as string;
}

async function createEmployee(orgId: string) {
  return prisma.employee.create({
    data: { firstName: "CW", lastName: "Employee", organizationId: orgId },
  });
}

async function createSchedule(orgId: string, startDate: string, endDate: string) {
  return prisma.schedule.create({
    data: {
      name: `Schedule ${startDate}`,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "PUBLISHED",
      organizationId: orgId,
    },
  });
}

async function seedWeekShifts(scheduleId: string, employeeId: string, weekStart: string) {
  const days = [0, 1, 2]; // 3 shifts across Mon, Tue, Wed
  return Promise.all(
    days.map((offset) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + offset);
      const dayStr = date.toISOString().split("T")[0];
      return prisma.shift.create({
        data: {
          scheduleId,
          employeeId,
          title: `Day ${offset + 1} Shift`,
          startTime: new Date(`${dayStr}T09:00:00.000Z`),
          endTime: new Date(`${dayStr}T17:00:00.000Z`),
          role: "Barista",
        },
      });
    })
  );
}

describe("POST /api/schedules/copy-week", () => {
  let orgId: string;
  let token: string;
  let sourceScheduleId: string;
  let employeeId: string;

  beforeAll(async () => {
    const org = await createOrg();
    orgId = org.id;
    const manager = await createManager(orgId);
    token = await loginAs(manager.email);
    const schedule = await createSchedule(orgId, "2026-04-06", "2026-04-12");
    sourceScheduleId = schedule.id;
    const emp = await createEmployee(orgId);
    employeeId = emp.id;
    await seedWeekShifts(sourceScheduleId, employeeId, "2026-04-06");
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Remove target week shifts between tests
    await prisma.shift.deleteMany({
      where: {
        schedule: { organizationId: orgId },
        startTime: {
          gte: new Date("2026-04-13"),
          lt: new Date("2026-04-20"),
        },
      },
    });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when sourceWeekStart is missing", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when targetWeekStart is missing", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when source and target weeks are the same", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-06" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { message: expect.stringMatching(/same week|cannot copy/i) } });
  });

  it("creates copies of all source week shifts in the target week", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(201);
    expect(res.body.shifts).toHaveLength(3);
  });

  it("offsets copied shift dates by exactly 7 days", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(201);
    const copiedDates: string[] = res.body.shifts.map((s: { startTime: string }) =>
      s.startTime.substring(0, 10)
    );
    expect(copiedDates).toEqual(
      expect.arrayContaining(["2026-04-13", "2026-04-14", "2026-04-15"])
    );
  });

  it("preserves shift title, role, and employee assignment in copies", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(201);
    res.body.shifts.forEach((s: { title: string; role: string; employeeId: string }) => {
      expect(s.title).toMatch(/Day \d+ Shift/);
      expect(s.role).toBe("Barista");
      expect(s.employeeId).toBe(employeeId);
    });
  });

  it("returns 409 when target week already has shifts", async () => {
    // First copy
    await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    // Second copy to same target
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: { message: expect.stringMatching(/already has shifts|conflict/i) },
    });
  });

  it("returns 404 when source week has no shifts to copy", async () => {
    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-05-04", targetWeekStart: "2026-05-11" });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { message: expect.stringMatching(/no shifts|source.*empty/i) },
    });
  });

  it("does not copy shifts from another organization", async () => {
    const otherOrg = await createOrg();
    const otherMgr = await createManager(otherOrg.id);
    const otherSchedule = await createSchedule(otherOrg.id, "2026-04-06", "2026-04-12");
    const otherEmp = await createEmployee(otherOrg.id);
    await seedWeekShifts(otherSchedule.id, otherEmp.id, "2026-04-06");

    const res = await request(app)
      .post("/api/schedules/copy-week")
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" });

    expect(res.status).toBe(201);
    // Only our org's 3 shifts, not the other org's 3
    expect(res.body.shifts).toHaveLength(3);
    res.body.shifts.forEach((s: { employeeId: string }) => {
      expect(s.employeeId).toBe(employeeId);
    });

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
