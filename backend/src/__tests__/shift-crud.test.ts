/**
 * TIM-57 — QA: Shift creation and management test suite
 * Subtask of TIM-34 — Shift Creation & Management
 *
 * Covers:
 *  TC-01: Happy path CRUD (create, read, update, delete, list)
 *  TC-02: Employee assignment (assign, remove, multi-assign)
 *  TC-03: Conflict detection (double-booking, unavailability)
 *  TC-04: RBAC (employee blocked on writes, cross-org isolation, admin access)
 *  TC-05: Validation edge cases (bad times, missing fields, headcount)
 */

import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function createOrg(label = "ShiftCRUD") {
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
    .send({ email, password });
  return res.body.accessToken as string;
}

async function createEmployee(orgId: string, name = "Emp", email?: string) {
  return prisma.employee.create({
    data: {
      firstName: name,
      lastName: "Worker",
      organizationId: orgId,
      email: email ?? null,
    },
  });
}

async function createSchedule(orgId: string) {
  return prisma.schedule.create({
    data: {
      name: `Schedule ${Date.now()}`,
      startDate: new Date("2026-05-05"),
      endDate: new Date("2026-05-11"),
      status: "PUBLISHED",
      organizationId: orgId,
    },
  });
}

function shiftPayload(scheduleId: string, overrides: Record<string, unknown> = {}) {
  return {
    scheduleId,
    title: "Morning Shift",
    startTime: "2026-05-05T08:00:00.000Z",
    endTime: "2026-05-05T16:00:00.000Z",
    location: "Front Counter",
    role: "Barista",
    requiredHeadcount: 2,
    ...overrides,
  };
}

// ── TC-01: Happy Path CRUD ────────────────────────────────────────────────────

describe("TC-01: Shift CRUD — Happy Path", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("CRUD");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-01.1: POST /api/shifts — creates shift with all fields, returns 201", async () => {
    const payload = shiftPayload(scheduleId);
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe("Morning Shift");
    expect(res.body.location).toBe("Front Counter");
    expect(res.body.role).toBe("Barista");
    expect(res.body.requiredHeadcount).toBe(2);
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.updatedAt).toBeDefined();
    expect(res.body.schedule).toBeDefined();
  });

  it("TC-01.2: POST /api/shifts — creates shift with minimal fields, requiredHeadcount defaults to 1", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Minimal Shift",
        startTime: "2026-05-06T09:00:00.000Z",
        endTime: "2026-05-06T17:00:00.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.requiredHeadcount).toBe(1);
    expect(res.body.location).toBeNull();
    expect(res.body.role).toBeNull();
  });

  it("TC-01.3: GET /api/shifts/:id — retrieves created shift", async () => {
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, { title: "Get Test Shift" }));

    const res = await request(app)
      .get(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.title).toBe("Get Test Shift");
    expect(res.body.assignments).toBeInstanceOf(Array);
  });

  it("TC-01.4: PUT /api/shifts/:id — updates title and endTime, reflects in response", async () => {
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, { title: "Before Update" }));

    const res = await request(app)
      .put(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "After Update", endTime: "2026-05-05T17:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("After Update");
    expect(res.body.endTime).toContain("17:00:00");
    // updatedAt should change
    expect(new Date(res.body.updatedAt) >= new Date(created.body.updatedAt)).toBe(true);
  });

  it("TC-01.5: DELETE /api/shifts/:id — returns 204, shift is gone", async () => {
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, { title: "To Delete" }));

    const del = await request(app)
      .delete(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(get.status).toBe(404);
  });

  it("TC-01.6: GET /api/shifts — lists shifts scoped to manager org only", async () => {
    // Create a second org with its own shift
    const org2 = await createOrg("CRUD-Other");
    const mgr2 = await createUser(org2.id, "MANAGER", "mgr2");
    const token2 = await loginAs(mgr2.email);
    const sched2 = await createSchedule(org2.id);
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token2}`)
      .send(shiftPayload(sched2.id, { title: "Org2 Shift" }));

    // Manager from org1 lists shifts — must NOT see org2's shift
    const res = await request(app)
      .get("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const titles = (res.body as Array<{ title: string }>).map((s) => s.title);
    expect(titles).not.toContain("Org2 Shift");

    await prisma.organization.deleteMany({ where: { id: org2.id } });
  });

  it("TC-01.7: GET /api/shifts/:id — returns 404 for shift in another org", async () => {
    const org2 = await createOrg("CRUD-Iso");
    const mgr2 = await createUser(org2.id, "MANAGER", "iso");
    const token2 = await loginAs(mgr2.email);
    const sched2 = await createSchedule(org2.id);
    const shift2 = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${token2}`)
      .send(shiftPayload(sched2.id, { title: "Isolated Shift" }));

    // Attempt to read from org1's manager
    const res = await request(app)
      .get(`/api/shifts/${shift2.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);

    await prisma.organization.deleteMany({ where: { id: org2.id } });
  });
});

// ── TC-02: Employee Assignment ────────────────────────────────────────────────

describe("TC-02: Employee Assignment", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;
  let shiftId: string;
  let empId1: string;
  let empId2: string;

  beforeAll(async () => {
    const org = await createOrg("Assign");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "assign-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
    const emp1 = await createEmployee(orgId, "Alice");
    empId1 = emp1.id;
    const emp2 = await createEmployee(orgId, "Bob");
    empId2 = emp2.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  beforeEach(async () => {
    // Fresh shift per test
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId));
    shiftId = res.body.id;
  });

  afterEach(async () => {
    await prisma.shift.deleteMany({ where: { scheduleId } });
  });

  it("TC-02.1: POST /api/shifts/:id/assign — assigns single employee, appears in assignments", async () => {
    const res = await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1] });

    expect(res.status).toBe(200);
    const assignedIds = res.body.assignments.map((a: { employeeId: string }) => a.employeeId);
    expect(assignedIds).toContain(empId1);
  });

  it("TC-02.2: POST /api/shifts/:id/assign — assigns multiple employees at once", async () => {
    const res = await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1, empId2] });

    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(2);
    const assignedIds = res.body.assignments.map((a: { employeeId: string }) => a.employeeId);
    expect(assignedIds).toContain(empId1);
    expect(assignedIds).toContain(empId2);
  });

  it("TC-02.3: POST /api/shifts/:id/assign — idempotent (re-assigning same employee is a no-op)", async () => {
    await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1] });

    const res = await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1] });

    expect(res.status).toBe(200);
    // Still only one assignment for that employee
    const forEmp = res.body.assignments.filter(
      (a: { employeeId: string }) => a.employeeId === empId1
    );
    expect(forEmp).toHaveLength(1);
  });

  it("TC-02.4: DELETE /api/shifts/:id/employees/:eid — removes assignment", async () => {
    await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1] });

    const del = await request(app)
      .delete(`/api/shifts/${shiftId}/employees/${empId1}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/api/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    const assignedIds = get.body.assignments.map((a: { employeeId: string }) => a.employeeId);
    expect(assignedIds).not.toContain(empId1);
  });

  it("TC-02.5: GET /api/shifts/:id — response includes employee details in assignments array", async () => {
    await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1] });

    const res = await request(app)
      .get(`/api/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.assignments[0].employee).toBeDefined();
    expect(res.body.assignments[0].employee.firstName).toBe("Alice");
  });

  it("TC-02.6: POST /api/shifts/:id/assign — 404 if employee not in org", async () => {
    const res = await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: ["00000000-0000-0000-0000-000000000000"] });

    expect(res.status).toBe(404);
  });

  it("TC-02.7: DELETE /api/shifts/:id/employees/:eid — deletes shift with assigned employees (cascade)", async () => {
    await request(app)
      .post(`/api/shifts/${shiftId}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId1, empId2] });

    const del = await request(app)
      .delete(`/api/shifts/${shiftId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(del.status).toBe(204);

    const assignments = await prisma.shiftAssignment.findMany({ where: { shiftId } });
    expect(assignments).toHaveLength(0);
  });
});

// ── TC-03: Conflict Detection ─────────────────────────────────────────────────

describe("TC-03: Conflict Detection", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;
  let empId: string;

  beforeAll(async () => {
    const org = await createOrg("Conflict");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "conflict-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
    const emp = await createEmployee(orgId, "Carol");
    empId = emp.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  afterEach(async () => {
    await prisma.shiftAssignment.deleteMany({ where: { shift: { scheduleId } } });
    await prisma.shift.deleteMany({ where: { scheduleId } });
    await prisma.availability.deleteMany({ where: { employee: { organizationId: orgId } } });
  });

  it("TC-03.1: double-booking — returns conflict when employee is assigned to overlapping shift", async () => {
    // Create two overlapping shifts and assign same employee
    const s1 = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, {
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
      }));

    const s2 = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, {
        startTime: "2026-05-05T12:00:00.000Z", // overlaps s1
        endTime: "2026-05-05T20:00:00.000Z",
      }));

    // Assign to first shift
    await request(app)
      .post(`/api/shifts/${s1.body.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId] });

    // Check conflicts for second shift
    const res = await request(app)
      .get(`/api/shifts/${s2.body.id}/conflicts?employeeId=${empId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const types = res.body.conflicts.map((c: { type: string }) => c.type);
    expect(types).toContain("double_booked");
  });

  it("TC-03.2: unavailability — returns conflict when employee is marked unavailable on shift day", async () => {
    // 2026-05-05 is a Tuesday (dayOfWeek = 2)
    await prisma.availability.create({
      data: {
        employeeId: empId,
        dayOfWeek: 2,
        startTime: "00:00",
        endTime: "23:59",
        type: "UNAVAILABLE",
      },
    });

    const shift = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, {
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
      }));

    const res = await request(app)
      .get(`/api/shifts/${shift.body.id}/conflicts?employeeId=${empId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const types = res.body.conflicts.map((c: { type: string }) => c.type);
    expect(types).toContain("unavailable");
  });

  it("TC-03.3: no conflicts returned when employee has no overlapping shifts or unavailability", async () => {
    const shift = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId));

    const res = await request(app)
      .get(`/api/shifts/${shift.body.id}/conflicts?employeeId=${empId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(0);
  });

  it("TC-03.4: no conflicts when no employeeId provided and shift has no assignments", async () => {
    const shift = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId));

    const res = await request(app)
      .get(`/api/shifts/${shift.body.id}/conflicts`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(0);
  });
});

// ── TC-04: RBAC ───────────────────────────────────────────────────────────────

describe("TC-04: RBAC", () => {
  let orgId: string;
  let managerToken: string;
  let adminToken: string;
  let employeeToken: string;
  let scheduleId: string;
  let existingShiftId: string;

  beforeAll(async () => {
    const org = await createOrg("RBAC");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "rbac-mgr");
    const admin = await createUser(orgId, "ADMIN", "rbac-admin");
    const employee = await createUser(orgId, "EMPLOYEE", "rbac-emp");

    managerToken = await loginAs(manager.email);
    adminToken = await loginAs(admin.email);
    employeeToken = await loginAs(employee.email);

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, { title: "RBAC Shift" }));
    existingShiftId = shift.body.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  // EMPLOYEE role
  it("TC-04.1: EMPLOYEE cannot create shifts (403)", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send(shiftPayload(scheduleId));
    expect(res.status).toBe(403);
  });

  it("TC-04.2: EMPLOYEE cannot update shifts (403)", async () => {
    const res = await request(app)
      .put(`/api/shifts/${existingShiftId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ title: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("TC-04.3: EMPLOYEE cannot delete shifts (403)", async () => {
    const res = await request(app)
      .delete(`/api/shifts/${existingShiftId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("TC-04.4: EMPLOYEE cannot assign employees to shifts (403)", async () => {
    const emp = await createEmployee(orgId, "Assign");
    const res = await request(app)
      .post(`/api/shifts/${existingShiftId}/assign`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ employeeIds: [emp.id] });
    expect(res.status).toBe(403);
  });

  it("TC-04.5: EMPLOYEE can read shifts (200)", async () => {
    const res = await request(app)
      .get(`/api/shifts/${existingShiftId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
  });

  // ADMIN role
  it("TC-04.6: ADMIN can create shifts", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(shiftPayload(scheduleId, { title: "Admin Created" }));
    expect(res.status).toBe(201);
  });

  it("TC-04.7: ADMIN can delete shifts", async () => {
    const shift = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(shiftPayload(scheduleId, { title: "Admin Delete" }));

    const res = await request(app)
      .delete(`/api/shifts/${shift.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  // MANAGER cross-org isolation
  it("TC-04.8: MANAGER cannot update shift in another org (404)", async () => {
    const org2 = await createOrg("RBAC-Iso");
    const mgr2 = await createUser(org2.id, "MANAGER", "cross");
    const tok2 = await loginAs(mgr2.email);
    const sched2 = await createSchedule(org2.id);
    const shift2 = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${tok2}`)
      .send(shiftPayload(sched2.id));

    // Manager from org1 tries to update org2's shift
    const res = await request(app)
      .put(`/api/shifts/${shift2.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Cross-Org Hack" });

    expect(res.status).toBe(404);

    await prisma.organization.deleteMany({ where: { id: org2.id } });
  });

  // Unauthenticated
  it("TC-04.9: unauthenticated request returns 401", async () => {
    const res = await request(app).get(`/api/shifts/${existingShiftId}`);
    expect(res.status).toBe(401);
  });
});

// ── TC-05: Validation Edge Cases ─────────────────────────────────────────────

describe("TC-05: Validation Edge Cases", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("Validation");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "val-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-05.1: missing required fields returns 400", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "No Times" }); // missing scheduleId, startTime, endTime
    expect(res.status).toBe(400);
  });

  it("TC-05.2: requiredHeadcount of 0 returns 400 (must be positive)", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, { requiredHeadcount: 0 }));
    expect(res.status).toBe(400);
  });

  it("TC-05.3: invalid datetime format returns 400", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, { startTime: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("TC-05.4: scheduleId that does not exist returns 404", async () => {
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload("00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(404);
  });

  it("TC-05.5: GET /api/shifts/:id — returns 404 for non-existent shift", async () => {
    const res = await request(app)
      .get("/api/shifts/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });

  it("TC-05.6: PUT /api/shifts/:id — returns 404 for non-existent shift", async () => {
    const res = await request(app)
      .put("/api/shifts/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("TC-05.7: DELETE /api/shifts/:id — returns 404 for non-existent shift", async () => {
    const res = await request(app)
      .delete("/api/shifts/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });

  it("TC-05.8: GET /api/shifts with from/to filter returns only shifts in range", async () => {
    // Create two shifts on different days
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, {
        title: "In Range",
        startTime: "2026-05-06T08:00:00.000Z",
        endTime: "2026-05-06T16:00:00.000Z",
      }));

    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(shiftPayload(scheduleId, {
        title: "Out of Range",
        startTime: "2026-05-10T08:00:00.000Z",
        endTime: "2026-05-10T16:00:00.000Z",
      }));

    const res = await request(app)
      .get("/api/shifts?from=2026-05-06T00:00:00.000Z&to=2026-05-07T00:00:00.000Z")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const titles = (res.body as Array<{ title: string }>).map((s) => s.title);
    expect(titles).toContain("In Range");
    expect(titles).not.toContain("Out of Range");
  });
});
