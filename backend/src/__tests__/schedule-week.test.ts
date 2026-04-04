/**
 * TIM-72 — Visual Schedule Builder QA
 * Backend API tests: GET /api/shifts (week-view via from/to params)
 *
 * Tests the shift list endpoint's week-view capability using the from/to
 * date filter params. Maps to TIM-35 acceptance criteria for rendering
 * all shifts in the correct day slots for a given week.
 */
import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

async function createOrg() {
  return prisma.organization.create({
    data: { name: `Week Test Org ${Date.now()}`, ownerUserId: "test-owner" },
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
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createEmployee(orgId: string) {
  return prisma.employee.create({
    data: { firstName: "Test", lastName: "Employee", organizationId: orgId },
  });
}

async function createSchedule(orgId: string) {
  return prisma.schedule.create({
    data: {
      name: "Week Test Schedule",
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

describe("GET /api/shifts — week-view filter", () => {
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
    await prisma.shift.deleteMany({ where: { scheduleId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get(
      "/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z"
    );
    expect(res.status).toBe(401);
  });

  it("returns an empty array when no shifts exist in the date range", async () => {
    const res = await request(app)
      .get("/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all shifts within the week window (Mon–Sun)", async () => {
    await Promise.all([
      createShift(scheduleId, employeeId, "2026-04-06"), // Mon
      createShift(scheduleId, employeeId, "2026-04-09"), // Thu
      createShift(scheduleId, employeeId, "2026-04-12"), // Sun
    ]);

    const res = await request(app)
      .get("/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it("excludes shifts outside the date range", async () => {
    await createShift(scheduleId, employeeId, "2026-04-05"); // day before
    await createShift(scheduleId, employeeId, "2026-04-13"); // day after
    await createShift(scheduleId, employeeId, "2026-04-08"); // within window

    const res = await request(app)
      .get("/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].startTime).toContain("2026-04-08");
  });

  it("does not return shifts from another organization", async () => {
    const otherOrg = await createOrg();
    const otherSchedule = await createSchedule(otherOrg.id);
    await createShift(otherSchedule.id, null, "2026-04-07");

    const res = await request(app)
      .get("/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("includes employee and schedule details in each shift", async () => {
    await createShift(scheduleId, employeeId, "2026-04-07");

    const res = await request(app)
      .get("/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      employee: expect.objectContaining({ id: employeeId }),
      schedule: expect.objectContaining({ id: scheduleId }),
    });
  });

  it("returns shifts sorted by startTime ascending", async () => {
    await createShift(scheduleId, employeeId, "2026-04-10");
    await createShift(scheduleId, employeeId, "2026-04-07");
    await createShift(scheduleId, employeeId, "2026-04-09");

    const res = await request(app)
      .get("/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const times: string[] = res.body.map((s: { startTime: string }) => s.startTime);
    expect(times).toEqual([...times].sort());
  });

  it("can filter by employeeId within a week (employee-column view)", async () => {
    const emp2 = await createEmployee(orgId);
    await createShift(scheduleId, employeeId, "2026-04-07");
    await createShift(scheduleId, emp2.id, "2026-04-07");

    const res = await request(app)
      .get(
        `/api/shifts?from=2026-04-06T00:00:00Z&to=2026-04-12T23:59:59Z&employeeId=${employeeId}`
      )
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(employeeId);
  });
});

describe("PUT /api/shifts/:id — drag-and-drop update", () => {
  let orgId: string;
  let token: string;
  let scheduleId: string;
  let employeeId: string;
  let shiftId: string;

  beforeAll(async () => {
    const org = await createOrg();
    orgId = org.id;
    const manager = await createManager(orgId);
    token = await loginAs(manager.email);
    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
    const emp = await createEmployee(orgId);
    employeeId = emp.id;
    const shift = await createShift(scheduleId, employeeId, "2026-04-07");
    shiftId = shift.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .put(`/api/shifts/${shiftId}`)
      .send({ startTime: "2026-04-08T08:00:00Z", endTime: "2026-04-08T16:00:00Z" });

    expect(res.status).toBe(401);
  });

  it("updates startTime and endTime when shift is moved to a new day", async () => {
    const res = await request(app)
      .put(`/api/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        startTime: "2026-04-08T08:00:00Z", // Wednesday
        endTime: "2026-04-08T16:00:00Z",
      });

    expect(res.status).toBe(200);
    expect(res.body.startTime).toContain("2026-04-08");
    expect(res.body.endTime).toContain("2026-04-08");
  });

  it("returns 404 when shift does not exist", async () => {
    const res = await request(app)
      .put("/api/shifts/nonexistent-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ startTime: "2026-04-08T08:00:00Z", endTime: "2026-04-08T16:00:00Z" });

    expect(res.status).toBe(404);
  });

  it("returns 403 or 404 when trying to update a shift from another organization", async () => {
    const otherOrg = await createOrg();
    const otherSchedule = await createSchedule(otherOrg.id);
    const otherShift = await createShift(otherSchedule.id, null, "2026-04-07");

    const res = await request(app)
      .put(`/api/shifts/${otherShift.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startTime: "2026-04-08T08:00:00Z", endTime: "2026-04-08T16:00:00Z" });

    expect([403, 404]).toContain(res.status);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
