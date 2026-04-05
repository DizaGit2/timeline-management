/**
 * TIM-184 — Schedule-to-shifts drill-down API tests
 *
 * Covers:
 *  TC-01: Nested list — GET /api/schedules/:scheduleId/shifts
 *  TC-02: Nested create — POST /api/schedules/:scheduleId/shifts
 *  TC-03: PATCH /api/shifts/:id (partial update)
 *  TC-04: Overlap validation on shift creation
 *  TC-05: RBAC and cross-org isolation for nested routes
 */

import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function createOrg(label = "Drilldown") {
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

async function createEmployee(orgId: string, name = "Emp") {
  return prisma.employee.create({
    data: {
      firstName: name,
      lastName: "Worker",
      organizationId: orgId,
    },
  });
}

async function seedSchedule(orgId: string) {
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

function nestedShiftPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Morning Shift",
    startTime: "2026-05-05T08:00:00.000Z",
    endTime: "2026-05-05T16:00:00.000Z",
    location: "Front Counter",
    role: "Barista",
    requiredHeadcount: 2,
    ...overrides,
  };
}

// ── TC-01: Nested List ───────────────────────────────────────────────────────

describe("TC-01: GET /api/schedules/:scheduleId/shifts — Nested List", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;
  let schedule2Id: string;

  beforeAll(async () => {
    const org = await createOrg("NestedList");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "nl-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await seedSchedule(orgId);
    scheduleId = schedule.id;
    const schedule2 = await seedSchedule(orgId);
    schedule2Id = schedule2.id;

    // Seed shifts into both schedules
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId, title: "S1-Shift-A", startTime: "2026-05-05T08:00:00.000Z", endTime: "2026-05-05T16:00:00.000Z" });
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId, title: "S1-Shift-B", startTime: "2026-05-06T08:00:00.000Z", endTime: "2026-05-06T16:00:00.000Z" });
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId: schedule2Id, title: "S2-Shift-A", startTime: "2026-05-05T08:00:00.000Z", endTime: "2026-05-05T16:00:00.000Z" });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-01.1: returns only shifts belonging to the specified schedule", async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const titles = res.body.map((s: { title: string }) => s.title);
    expect(titles).toContain("S1-Shift-A");
    expect(titles).toContain("S1-Shift-B");
    expect(titles).not.toContain("S2-Shift-A");
  });

  it("TC-01.2: returns shifts ordered by startTime ascending", async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const times = res.body.map((s: { startTime: string }) => new Date(s.startTime).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });

  it("TC-01.3: includes employee and schedule details in response", async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].schedule).toBeDefined();
    expect(res.body[0].assignments).toBeInstanceOf(Array);
  });

  it("TC-01.4: returns 404 for non-existent schedule", async () => {
    const res = await request(app)
      .get("/api/schedules/00000000-0000-0000-0000-000000000000/shifts")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });

  it("TC-01.5: returns empty array for schedule with no shifts", async () => {
    const emptySchedule = await seedSchedule(orgId);
    const res = await request(app)
      .get(`/api/schedules/${emptySchedule.id}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("TC-01.6: EMPLOYEE can list shifts (read access)", async () => {
    const emp = await createUser(orgId, "EMPLOYEE", "nl-emp");
    const empToken = await loginAs(emp.email);

    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
  });

  it("TC-01.7: unauthenticated returns 401", async () => {
    const res = await request(app)
      .get(`/api/schedules/${scheduleId}/shifts`);

    expect(res.status).toBe(401);
  });
});

// ── TC-02: Nested Create ─────────────────────────────────────────────────────

describe("TC-02: POST /api/schedules/:scheduleId/shifts — Nested Create", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("NestedCreate");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "nc-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await seedSchedule(orgId);
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-02.1: creates shift via nested route, returns 201 with scheduleId from URL", async () => {
    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(nestedShiftPayload());

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.scheduleId).toBe(scheduleId);
    expect(res.body.title).toBe("Morning Shift");
    expect(res.body.role).toBe("Barista");
  });

  it("TC-02.2: creates shift with minimal fields", async () => {
    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        title: "Minimal Nested",
        startTime: "2026-05-06T09:00:00.000Z",
        endTime: "2026-05-06T17:00:00.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.requiredHeadcount).toBe(1);
    expect(res.body.location).toBeNull();
  });

  it("TC-02.3: creates shift with employeeId", async () => {
    const emp = await createEmployee(orgId, "Nested");
    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(nestedShiftPayload({
        employeeId: emp.id,
        startTime: "2026-05-07T08:00:00.000Z",
        endTime: "2026-05-07T16:00:00.000Z",
      }));

    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(emp.id);
  });

  it("TC-02.4: returns 404 for non-existent schedule", async () => {
    const res = await request(app)
      .post("/api/schedules/00000000-0000-0000-0000-000000000000/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(nestedShiftPayload());

    expect(res.status).toBe(404);
  });

  it("TC-02.5: returns 404 for employee not in org", async () => {
    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(nestedShiftPayload({ employeeId: "00000000-0000-0000-0000-000000000000" }));

    expect(res.status).toBe(404);
  });

  it("TC-02.6: returns 400 for missing required fields", async () => {
    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Missing Times" });

    expect(res.status).toBe(400);
  });

  it("TC-02.7: EMPLOYEE cannot create shifts (403)", async () => {
    const emp = await createUser(orgId, "EMPLOYEE", "nc-emp");
    const empToken = await loginAs(emp.email);

    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${empToken}`)
      .send(nestedShiftPayload());

    expect(res.status).toBe(403);
  });

  it("TC-02.8: shift created via nested route appears in nested list", async () => {
    const created = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(nestedShiftPayload({ title: "Visible In List" }));

    const list = await request(app)
      .get(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`);

    const titles = list.body.map((s: { title: string }) => s.title);
    expect(titles).toContain("Visible In List");
  });
});

// ── TC-03: PATCH /api/shifts/:id ─────────────────────────────────────────────

describe("TC-03: PATCH /api/shifts/:id — Partial Update", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("Patch");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "patch-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await seedSchedule(orgId);
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-03.1: PATCH updates title only, returns 200", async () => {
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId, title: "Before Patch", startTime: "2026-05-05T08:00:00.000Z", endTime: "2026-05-05T16:00:00.000Z" });

    const res = await request(app)
      .patch(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "After Patch" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("After Patch");
    expect(res.body.startTime).toContain("08:00:00");
  });

  it("TC-03.2: PATCH updates role and location", async () => {
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId, title: "Patch Multi", startTime: "2026-05-06T08:00:00.000Z", endTime: "2026-05-06T16:00:00.000Z", role: "Cashier", location: "Register 1" });

    const res = await request(app)
      .patch(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "Server", location: "Dining Room" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("Server");
    expect(res.body.location).toBe("Dining Room");
  });

  it("TC-03.3: PATCH changes employee assignment", async () => {
    const emp = await createEmployee(orgId, "PatchEmp");
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId, title: "Reassign", startTime: "2026-05-07T08:00:00.000Z", endTime: "2026-05-07T16:00:00.000Z" });

    const res = await request(app)
      .patch(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeId: emp.id });

    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe(emp.id);
  });

  it("TC-03.4: PATCH returns 404 for non-existent shift", async () => {
    const res = await request(app)
      .patch("/api/shifts/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });

  it("TC-03.5: EMPLOYEE cannot PATCH shifts (403)", async () => {
    const empUser = await createUser(orgId, "EMPLOYEE", "patch-emp");
    const empToken = await loginAs(empUser.email);
    const created = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ scheduleId, title: "RBAC Patch", startTime: "2026-05-08T08:00:00.000Z", endTime: "2026-05-08T16:00:00.000Z" });

    const res = await request(app)
      .patch(`/api/shifts/${created.body.id}`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ title: "Hacked" });

    expect(res.status).toBe(403);
  });
});

// ── TC-04: Overlap Validation ────────────────────────────────────────────────

describe("TC-04: Overlap Validation on Create", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;
  let empId: string;

  beforeAll(async () => {
    const org = await createOrg("Overlap");
    orgId = org.id;
    const manager = await createUser(orgId, "MANAGER", "ovlp-mgr");
    managerToken = await loginAs(manager.email);
    const schedule = await seedSchedule(orgId);
    scheduleId = schedule.id;
    const emp = await createEmployee(orgId, "OverlapEmp");
    empId = emp.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  afterEach(async () => {
    await prisma.shiftAssignment.deleteMany({ where: { shift: { scheduleId } } });
    await prisma.shift.deleteMany({ where: { scheduleId } });
  });

  it("TC-04.1: rejects create when employee already has overlapping shift (legacy employeeId)", async () => {
    // Create existing shift for the employee
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Existing Shift",
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
        employeeId: empId,
      });

    // Try to create an overlapping shift for the same employee
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Overlapping Shift",
        startTime: "2026-05-05T12:00:00.000Z",
        endTime: "2026-05-05T20:00:00.000Z",
        employeeId: empId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("overlapping");
  });

  it("TC-04.2: rejects create when employee has overlapping shift via assignment", async () => {
    const shift1 = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Assigned Shift",
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
      });

    // Assign employee via ShiftAssignment
    await request(app)
      .post(`/api/shifts/${shift1.body.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [empId] });

    // Try to create overlapping shift with employeeId
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Overlapping With Assignment",
        startTime: "2026-05-05T15:00:00.000Z",
        endTime: "2026-05-05T23:00:00.000Z",
        employeeId: empId,
      });

    expect(res.status).toBe(409);
  });

  it("TC-04.3: allows create when shifts are adjacent (no overlap)", async () => {
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Morning",
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
        employeeId: empId,
      });

    // Adjacent shift (starts exactly when previous ends)
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Evening",
        startTime: "2026-05-05T16:00:00.000Z",
        endTime: "2026-05-05T23:59:00.000Z",
        employeeId: empId,
      });

    expect(res.status).toBe(201);
  });

  it("TC-04.4: allows create without employeeId (unassigned shift)", async () => {
    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Existing",
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
        employeeId: empId,
      });

    // Overlapping time but no employee assigned — should be fine
    const res = await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        scheduleId,
        title: "Unassigned",
        startTime: "2026-05-05T10:00:00.000Z",
        endTime: "2026-05-05T18:00:00.000Z",
      });

    expect(res.status).toBe(201);
  });

  it("TC-04.5: rejects overlap via nested create route too", async () => {
    await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        title: "Existing Nested",
        startTime: "2026-05-05T08:00:00.000Z",
        endTime: "2026-05-05T16:00:00.000Z",
        employeeId: empId,
      });

    const res = await request(app)
      .post(`/api/schedules/${scheduleId}/shifts`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        title: "Overlap Nested",
        startTime: "2026-05-05T10:00:00.000Z",
        endTime: "2026-05-05T14:00:00.000Z",
        employeeId: empId,
      });

    expect(res.status).toBe(409);
  });
});

// ── TC-05: Cross-Org Isolation ───────────────────────────────────────────────

describe("TC-05: Cross-Org Isolation for Nested Routes", () => {
  let org1Id: string;
  let org2Id: string;
  let manager1Token: string;
  let manager2Token: string;
  let schedule1Id: string;
  let schedule2Id: string;

  beforeAll(async () => {
    const org1 = await createOrg("Iso1");
    org1Id = org1.id;
    const org2 = await createOrg("Iso2");
    org2Id = org2.id;

    const mgr1 = await createUser(org1Id, "MANAGER", "iso1-mgr");
    const mgr2 = await createUser(org2Id, "MANAGER", "iso2-mgr");
    manager1Token = await loginAs(mgr1.email);
    manager2Token = await loginAs(mgr2.email);

    const sched1 = await seedSchedule(org1Id);
    schedule1Id = sched1.id;
    const sched2 = await seedSchedule(org2Id);
    schedule2Id = sched2.id;

    await request(app)
      .post("/api/shifts")
      .set("Authorization", `Bearer ${manager1Token}`)
      .send({ scheduleId: schedule1Id, title: "Org1 Shift", startTime: "2026-05-05T08:00:00.000Z", endTime: "2026-05-05T16:00:00.000Z" });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [org1Id, org2Id] } } });
  });

  it("TC-05.1: manager cannot list shifts from another org's schedule", async () => {
    const res = await request(app)
      .get(`/api/schedules/${schedule1Id}/shifts`)
      .set("Authorization", `Bearer ${manager2Token}`);

    expect(res.status).toBe(404);
  });

  it("TC-05.2: manager cannot create shift in another org's schedule", async () => {
    const res = await request(app)
      .post(`/api/schedules/${schedule1Id}/shifts`)
      .set("Authorization", `Bearer ${manager2Token}`)
      .send(nestedShiftPayload());

    expect(res.status).toBe(404);
  });
});
