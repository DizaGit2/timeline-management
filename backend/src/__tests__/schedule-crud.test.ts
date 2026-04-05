/**
 * TIM-114 — QA: Schedule management CRUD test suite
 * Subtask of TIM-112 — Test plan for employee management and schedule management
 *
 * Covers schedule management (TIM-103) REST API:
 *  TC-SCH-01: List schedules (GET /api/schedules)
 *  TC-SCH-02: Get single schedule with shifts (GET /api/schedules/:id)
 *  TC-SCH-03: Create schedule (POST /api/schedules)
 *  TC-SCH-04: Update schedule (PUT /api/schedules/:id)
 *  TC-SCH-05: Delete schedule (DELETE /api/schedules/:id)
 *  TC-SCH-06: RBAC — EMPLOYEE read-only, MANAGER/ADMIN write access
 *  TC-SCH-07: Cross-org isolation
 *  TC-SCH-08: Input validation
 *  TC-SCH-09: Date range validation (endDate before startDate)
 */

import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

// IP rotation to avoid the login rate limiter (10 attempts per IP per 15 min)
let _ipCounter = 1;
function nextIp(): string {
  return `10.1.${Math.floor(_ipCounter / 255)}.${_ipCounter++ % 255 + 1}`;
}

async function createOrg(label = "Sched") {
  return prisma.organization.create({
    data: { name: `${label} Org ${Date.now()}`, ownerUserId: "test-owner" },
  });
}

async function createUser(
  orgId: string,
  role: "ADMIN" | "MANAGER" | "EMPLOYEE",
  label = ""
) {
  const bcrypt = await import("bcryptjs");
  const tag = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prisma.user.create({
    data: {
      email: `${tag}@test.com`,
      passwordHash: await bcrypt.hash("password", 1),
      name: `${role} ${label}`,
      role,
      organizationId: orgId,
    },
  });
}

async function loginAs(email: string, password = "password") {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", nextIp())
    .send({ email, password });
  return res.body.accessToken as string;
}

async function createEmployee(orgId: string) {
  return prisma.employee.create({
    data: { firstName: "Test", lastName: "Employee", organizationId: orgId },
  });
}

async function seedSchedule(
  orgId: string,
  overrides: Record<string, unknown> = {}
) {
  return prisma.schedule.create({
    data: {
      name: `Schedule ${Date.now()}`,
      startDate: new Date("2026-05-05"),
      endDate: new Date("2026-05-11"),
      status: "DRAFT",
      organizationId: orgId,
      ...overrides,
    },
  });
}

// ── TC-SCH-01: List schedules ─────────────────────────────────────────────────

describe("GET /api/schedules — list schedules", () => {
  let orgId: string;
  let token: string;

  beforeAll(async () => {
    const org = await createOrg("List");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "list");
    token = await loginAs(manager.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  beforeEach(async () => {
    await prisma.schedule.deleteMany({ where: { organizationId: orgId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/schedules");
    expect(res.status).toBe(401);
  });

  it("returns empty array when no schedules exist", async () => {
    const res = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all schedules for the organization", async () => {
    await seedSchedule(orgId, { name: "Week A" });
    await seedSchedule(orgId, { name: "Week B" });

    const res = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const names = res.body.map((s: { name: string }) => s.name);
    expect(names).toContain("Week A");
    expect(names).toContain("Week B");
  });

  it("returns schedules ordered by startDate descending", async () => {
    await seedSchedule(orgId, {
      name: "Earlier",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-07"),
    });
    await seedSchedule(orgId, {
      name: "Later",
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-05-07"),
    });

    const res = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Later");
    expect(res.body[1].name).toBe("Earlier");
  });

  it("does not return schedules from another organization", async () => {
    const otherOrg = await createOrg("Other");
    await seedSchedule(otherOrg.id, { name: "Other Org Schedule" });

    const res = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.map((s: { name: string }) => s.name);
    expect(names).not.toContain("Other Org Schedule");

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("allows EMPLOYEE role to list schedules", async () => {
    const employee = await createUser(orgId, "EMPLOYEE", "emp-list");
    const empToken = await loginAs(employee.email);
    await seedSchedule(orgId, { name: "Employee Visible" });

    const res = await request(app)
      .get("/api/schedules")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ── TC-SCH-02: Get single schedule ───────────────────────────────────────────

describe("GET /api/schedules/:id — get single schedule", () => {
  let orgId: string;
  let token: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("Get");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "get");
    token = await loginAs(manager.email);
    const schedule = await seedSchedule(orgId, {
      name: "Get Test Schedule",
      status: "PUBLISHED",
    });
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get(`/api/schedules/${scheduleId}`);
    expect(res.status).toBe(401);
  });

  it("returns the schedule with id, name, dates, and status", async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: scheduleId,
      name: "Get Test Schedule",
      status: "PUBLISHED",
    });
    expect(res.body.startDate).toBeDefined();
    expect(res.body.endDate).toBeDefined();
  });

  it("includes shifts array in the response", async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.shifts)).toBe(true);
  });

  it("includes employee data on shifts", async () => {
    const employee = await createEmployee(orgId);
    await prisma.shift.create({
      data: {
        scheduleId,
        employeeId: employee.id,
        title: "Morning",
        startTime: new Date("2026-05-05T08:00:00Z"),
        endTime: new Date("2026-05-05T16:00:00Z"),
      },
    });

    const res = await request(app)
      .get(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.shifts).toHaveLength(1);
    expect(res.body.shifts[0].employee).toMatchObject({ id: employee.id });
  });

  it("returns 404 for a non-existent schedule ID", async () => {
    const res = await request(app)
      .get("/api/schedules/nonexistent-id-abc")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when accessing a schedule from another organization", async () => {
    const otherOrg = await createOrg("OtherGet");
    const otherSchedule = await seedSchedule(otherOrg.id, { name: "Cross-org schedule" });

    const res = await request(app)
      .get(`/api/schedules/${otherSchedule.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});

// ── TC-SCH-03: Create schedule ───────────────────────────────────────────────

describe("POST /api/schedules — create schedule", () => {
  let orgId: string;
  let managerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    const org = await createOrg("Create");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "create-mgr");
    managerToken = await loginAs(manager.email);
    const emp = await createUser(orgId, "EMPLOYEE", "create-emp");
    employeeToken = await loginAs(emp.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).post("/api/schedules").send({
      name: "New Schedule",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-07T23:59:59.000Z",
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when an EMPLOYEE tries to create a schedule", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        name: "Employee Schedule",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-07T23:59:59.000Z",
      });

    expect(res.status).toBe(403);
  });

  it("creates a schedule with valid payload", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "June Week 1",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-07T23:59:59.000Z",
        status: "DRAFT",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "June Week 1",
      status: "DRAFT",
      organizationId: orgId,
    });
    expect(res.body.id).toBeDefined();
  });

  it("defaults status to DRAFT when not provided", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Draft Default Schedule",
        startDate: "2026-06-08T00:00:00.000Z",
        endDate: "2026-06-14T23:59:59.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DRAFT");
  });

  it("creates a schedule with PUBLISHED status", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Published Schedule",
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-21T23:59:59.000Z",
        status: "PUBLISHED",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PUBLISHED");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-07T23:59:59.000Z",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is an empty string", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-07T23:59:59.000Z",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when startDate is missing", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "No Start",
        endDate: "2026-06-07T23:59:59.000Z",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when endDate is missing", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "No End",
        startDate: "2026-06-01T00:00:00.000Z",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when startDate is not a valid ISO datetime", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Bad Date",
        startDate: "not-a-date",
        endDate: "2026-06-07T23:59:59.000Z",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when status is not a recognized value", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Bad Status",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-07T23:59:59.000Z",
        status: "INVALID_STATUS",
      });

    expect(res.status).toBe(400);
  });

  it("allows ADMIN to create a schedule", async () => {
    const admin = await createUser(orgId, "ADMIN", "create-admin");
    const adminToken = await loginAs(admin.email);

    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Admin Created Schedule",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-07T23:59:59.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Admin Created Schedule");
  });
});

// ── TC-SCH-04: Update schedule ───────────────────────────────────────────────

describe("PUT /api/schedules/:id — update schedule", () => {
  let orgId: string;
  let managerToken: string;
  let employeeToken: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("Update");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "update-mgr");
    managerToken = await loginAs(manager.email);
    const emp = await createUser(orgId, "EMPLOYEE", "update-emp");
    employeeToken = await loginAs(emp.email);
    const schedule = await seedSchedule(orgId, { name: "Original Name" });
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .send({ name: "Unauthorized Update" });

    expect(res.status).toBe(401);
  });

  it("returns 403 when an EMPLOYEE tries to update a schedule", async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "Employee Update Attempt" });

    expect(res.status).toBe(403);
  });

  it("updates the schedule name", async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
  });

  it("updates the status from DRAFT to PUBLISHED", async () => {
    const schedule = await seedSchedule(orgId, { name: "Draft Schedule", status: "DRAFT" });

    const res = await request(app)
      .put(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "PUBLISHED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PUBLISHED");
  });

  it("updates the status from PUBLISHED to ARCHIVED", async () => {
    const schedule = await seedSchedule(orgId, {
      name: "Published Schedule",
      status: "PUBLISHED",
    });

    const res = await request(app)
      .put(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "ARCHIVED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ARCHIVED");
  });

  it("updates start and end dates", async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-07T23:59:59.000Z",
      });

    expect(res.status).toBe(200);
    expect(res.body.startDate).toContain("2026-07-01");
    expect(res.body.endDate).toContain("2026-07-07");
  });

  it("allows partial updates — only provided fields change", async () => {
    const beforeRes = await request(app)
      .get(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    const originalStatus = beforeRes.body.status;

    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Partial Update Only" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Partial Update Only");
    expect(res.body.status).toBe(originalStatus);
  });

  it("returns 404 when updating a non-existent schedule", async () => {
    const res = await request(app)
      .put("/api/schedules/nonexistent-schedule-id")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Ghost Update" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when updating a schedule from another organization", async () => {
    const otherOrg = await createOrg("OtherUpdate");
    const otherSchedule = await seedSchedule(otherOrg.id, { name: "Cross-org" });

    const res = await request(app)
      .put(`/api/schedules/${otherSchedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ name: "Hijacked Name" });

    expect(res.status).toBe(404);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("returns 400 when setting status to an invalid value", async () => {
    const res = await request(app)
      .put(`/api/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "UNKNOWN_STATUS" });

    expect(res.status).toBe(400);
  });
});

// ── TC-SCH-05: Delete schedule ───────────────────────────────────────────────

describe("DELETE /api/schedules/:id — delete schedule", () => {
  let orgId: string;
  let managerToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    const org = await createOrg("Delete");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "delete-mgr");
    managerToken = await loginAs(manager.email);
    const emp = await createUser(orgId, "EMPLOYEE", "delete-emp");
    employeeToken = await loginAs(emp.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 401 when not authenticated", async () => {
    const schedule = await seedSchedule(orgId, { name: "Auth Delete Test" });
    const res = await request(app).delete(`/api/schedules/${schedule.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when an EMPLOYEE tries to delete a schedule", async () => {
    const schedule = await seedSchedule(orgId, { name: "Employee Delete Test" });
    const res = await request(app)
      .delete(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it("deletes the schedule and returns 204", async () => {
    const schedule = await seedSchedule(orgId, { name: "To Be Deleted" });

    const res = await request(app)
      .delete(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(204);

    // Verify deletion
    const verifyRes = await request(app)
      .get(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(verifyRes.status).toBe(404);
  });

  it("cascades deletion to child shifts", async () => {
    const schedule = await seedSchedule(orgId, { name: "With Shifts" });
    const employee = await createEmployee(orgId);
    await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        employeeId: employee.id,
        title: "Shift to delete",
        startTime: new Date("2026-05-05T08:00:00Z"),
        endTime: new Date("2026-05-05T16:00:00Z"),
      },
    });

    const res = await request(app)
      .delete(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(204);

    const orphanedShifts = await prisma.shift.findMany({
      where: { scheduleId: schedule.id },
    });
    expect(orphanedShifts).toHaveLength(0);
  });

  it("returns 404 when deleting a non-existent schedule", async () => {
    const res = await request(app)
      .delete("/api/schedules/nonexistent-delete-id")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting a schedule from another organization", async () => {
    const otherOrg = await createOrg("OtherDelete");
    const otherSchedule = await seedSchedule(otherOrg.id, { name: "Other org schedule" });

    const res = await request(app)
      .delete(`/api/schedules/${otherSchedule.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("allows ADMIN to delete a schedule", async () => {
    const admin = await createUser(orgId, "ADMIN", "delete-admin");
    const adminToken = await loginAs(admin.email);
    const schedule = await seedSchedule(orgId, { name: "Admin Delete" });

    const res = await request(app)
      .delete(`/api/schedules/${schedule.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });
});

// ── TC-SCH-09: Date range validation ─────────────────────────────────────────

describe("Schedule date range — endDate before startDate", () => {
  let orgId: string;
  let managerToken: string;

  beforeAll(async () => {
    const org = await createOrg("DateRange");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "daterange-mgr");
    managerToken = await loginAs(manager.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("rejects creating a schedule where endDate is before startDate", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Invalid Range",
        startDate: "2026-06-07T00:00:00.000Z",
        endDate: "2026-06-01T00:00:00.000Z", // before startDate
      });

    // The API should reject this with 400 (Bad Request)
    expect(res.status).toBe(400);
  });

  it("rejects creating a schedule where startDate equals endDate", async () => {
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Same Day",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-01T00:00:00.000Z",
      });

    // Same start and end date is ambiguous — a schedule should span at least one day
    expect(res.status).toBe(400);
  });
});
