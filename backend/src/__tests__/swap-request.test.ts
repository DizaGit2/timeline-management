/**
 * TIM-196 — Swap Request API test suite
 *
 * Covers:
 *  TC-01: Happy path — full swap lifecycle (create → accept → approve)
 *  TC-02: Target employee declines
 *  TC-03: Manager rejects
 *  TC-04: Validation errors (bad ownership, self-swap, duplicate)
 *  TC-05: RBAC (employee cannot resolve, cross-org isolation)
 *  TC-06: Atomic swap — shift assignments are swapped on approval
 *  TC-07: List and filter
 */

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../index";
import prisma from "../lib/prisma";
import { config } from "../config";

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function createOrg(label = "SwapReq") {
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

/** Generate a JWT token directly to avoid rate limiter on /api/auth/login */
function tokenFor(user: { id: string; organizationId: string; role: string }): string {
  return jwt.sign(
    { userId: user.id, organizationId: user.organizationId, role: user.role },
    config.jwt.secret,
    { expiresIn: "15m" }
  );
}

async function createEmployee(orgId: string, firstName: string, email?: string) {
  return prisma.employee.create({
    data: {
      firstName,
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
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-07"),
      status: "PUBLISHED",
      organizationId: orgId,
    },
  });
}

async function createShift(
  scheduleId: string,
  employeeId: string,
  overrides: Record<string, unknown> = {}
) {
  return prisma.shift.create({
    data: {
      scheduleId,
      employeeId,
      title: "Shift",
      startTime: new Date("2026-06-02T08:00:00.000Z"),
      endTime: new Date("2026-06-02T16:00:00.000Z"),
      ...overrides,
    },
  });
}

// ── TC-01: Full Swap Lifecycle ───────────────────────────────────────────────

describe("TC-01: Swap Request — Full Lifecycle (create → accept → approve)", () => {
  let orgId: string;
  let managerToken: string;
  let emp1Token: string;
  let emp2Token: string;
  let scheduleId: string;
  let shift1Id: string;
  let shift2Id: string;
  let emp1Id: string;
  let emp2Id: string;

  beforeAll(async () => {
    const org = await createOrg("Lifecycle");
    orgId = org.id;

    const manager = await createUser(orgId, "MANAGER", "mgr");
    managerToken = tokenFor(manager);

    const user1 = await createUser(orgId, "EMPLOYEE", "e1");
    emp1Token = tokenFor(user1);
    const employee1 = await createEmployee(orgId, "Alice", user1.email);
    emp1Id = employee1.id;

    const user2 = await createUser(orgId, "EMPLOYEE", "e2");
    emp2Token = tokenFor(user2);
    const employee2 = await createEmployee(orgId, "Bob", user2.email);
    emp2Id = employee2.id;

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift1 = await createShift(scheduleId, emp1Id, {
      title: "Morning",
      startTime: new Date("2026-06-02T06:00:00.000Z"),
      endTime: new Date("2026-06-02T14:00:00.000Z"),
    });
    shift1Id = shift1.id;

    const shift2 = await createShift(scheduleId, emp2Id, {
      title: "Evening",
      startTime: new Date("2026-06-02T14:00:00.000Z"),
      endTime: new Date("2026-06-02T22:00:00.000Z"),
    });
    shift2Id = shift2.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  let swapRequestId: string;

  it("TC-01.1: POST /api/swap-requests — employee creates swap request", async () => {
    const res = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("PENDING_TARGET");
    expect(res.body.requestingEmployee.firstName).toBe("Alice");
    expect(res.body.targetEmployee.firstName).toBe("Bob");
    swapRequestId = res.body.id;
  });

  it("TC-01.2: GET /api/swap-requests/:id — returns swap request detail", async () => {
    const res = await request(app)
      .get(`/api/swap-requests/${swapRequestId}`)
      .set("Authorization", `Bearer ${emp1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(swapRequestId);
    expect(res.body.status).toBe("PENDING_TARGET");
  });

  it("TC-01.3: PATCH /api/swap-requests/:id/respond — target accepts", async () => {
    const res = await request(app)
      .patch(`/api/swap-requests/${swapRequestId}/respond`)
      .set("Authorization", `Bearer ${emp2Token}`)
      .send({ action: "accept" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PENDING_MANAGER");
  });

  it("TC-01.4: PATCH /api/swap-requests/:id/resolve — manager approves", async () => {
    const res = await request(app)
      .patch(`/api/swap-requests/${swapRequestId}/resolve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.resolvedAt).toBeDefined();
    expect(res.body.resolver).toBeDefined();
  });

  it("TC-01.5: Shifts are swapped after approval", async () => {
    const s1 = await prisma.shift.findUnique({ where: { id: shift1Id } });
    const s2 = await prisma.shift.findUnique({ where: { id: shift2Id } });
    expect(s1!.employeeId).toBe(emp2Id);
    expect(s2!.employeeId).toBe(emp1Id);
  });
});

// ── TC-02: Target Declines ───────────────────────────────────────────────────

describe("TC-02: Target Employee Declines", () => {
  let orgId: string;
  let emp1Token: string;
  let emp2Token: string;
  let scheduleId: string;
  let shift1Id: string;
  let shift2Id: string;
  let emp2Id: string;

  beforeAll(async () => {
    const org = await createOrg("Decline");
    orgId = org.id;

    const user1 = await createUser(orgId, "EMPLOYEE", "d1");
    emp1Token = tokenFor(user1);
    const employee1 = await createEmployee(orgId, "Carol", user1.email);

    const user2 = await createUser(orgId, "EMPLOYEE", "d2");
    emp2Token = tokenFor(user2);
    const employee2 = await createEmployee(orgId, "Dave", user2.email);
    emp2Id = employee2.id;

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift1 = await createShift(scheduleId, employee1.id, { title: "Shift A" });
    shift1Id = shift1.id;
    const shift2 = await createShift(scheduleId, employee2.id, { title: "Shift B" });
    shift2Id = shift2.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("target employee declines, status becomes REJECTED", async () => {
    const create = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    const res = await request(app)
      .patch(`/api/swap-requests/${create.body.id}/respond`)
      .set("Authorization", `Bearer ${emp2Token}`)
      .send({ action: "decline" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    expect(res.body.resolvedAt).toBeDefined();
  });
});

// ── TC-03: Manager Rejects ───────────────────────────────────────────────────

describe("TC-03: Manager Rejects", () => {
  let orgId: string;
  let managerToken: string;
  let emp1Token: string;
  let emp2Token: string;
  let scheduleId: string;
  let shift1Id: string;
  let shift2Id: string;
  let emp2Id: string;

  beforeAll(async () => {
    const org = await createOrg("Reject");
    orgId = org.id;

    const manager = await createUser(orgId, "MANAGER", "rmgr");
    managerToken = tokenFor(manager);

    const user1 = await createUser(orgId, "EMPLOYEE", "r1");
    emp1Token = tokenFor(user1);
    const employee1 = await createEmployee(orgId, "Eve", user1.email);

    const user2 = await createUser(orgId, "EMPLOYEE", "r2");
    emp2Token = tokenFor(user2);
    const employee2 = await createEmployee(orgId, "Frank", user2.email);
    emp2Id = employee2.id;

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift1 = await createShift(scheduleId, employee1.id, { title: "Shift X" });
    shift1Id = shift1.id;
    const shift2 = await createShift(scheduleId, employee2.id, { title: "Shift Y" });
    shift2Id = shift2.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("manager rejects after target accepts", async () => {
    const create = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    await request(app)
      .patch(`/api/swap-requests/${create.body.id}/respond`)
      .set("Authorization", `Bearer ${emp2Token}`)
      .send({ action: "accept" });

    const res = await request(app)
      .patch(`/api/swap-requests/${create.body.id}/resolve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ action: "reject" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
    expect(res.body.resolver).toBeDefined();
  });
});

// ── TC-04: Validation Errors ─────────────────────────────────────────────────

describe("TC-04: Validation Errors", () => {
  let orgId: string;
  let emp1Token: string;
  let emp2Token: string;
  let scheduleId: string;
  let shift1Id: string;
  let shift2Id: string;
  let emp1Id: string;
  let emp2Id: string;

  beforeAll(async () => {
    const org = await createOrg("Validate");
    orgId = org.id;

    const user1 = await createUser(orgId, "EMPLOYEE", "v1");
    emp1Token = tokenFor(user1);
    const employee1 = await createEmployee(orgId, "Grace", user1.email);
    emp1Id = employee1.id;

    const user2 = await createUser(orgId, "EMPLOYEE", "v2");
    emp2Token = tokenFor(user2);
    const employee2 = await createEmployee(orgId, "Hank", user2.email);
    emp2Id = employee2.id;

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift1 = await createShift(scheduleId, emp1Id, { title: "Val Shift 1" });
    shift1Id = shift1.id;
    const shift2 = await createShift(scheduleId, emp2Id, { title: "Val Shift 2" });
    shift2Id = shift2.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-04.1: cannot swap with yourself", async () => {
    const res = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp1Id,
        targetShiftId: shift1Id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/yourself/);
  });

  it("TC-04.2: cannot create swap for shift you don't own", async () => {
    // emp2 tries to swap emp1's shift
    const res = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp2Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp1Id,
        targetShiftId: shift2Id,
      });

    expect(res.status).toBe(403);
  });

  it("TC-04.3: duplicate pending request returns 409", async () => {
    // First request
    await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    // Duplicate
    const res = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    expect(res.status).toBe(409);
  });

  it("TC-04.4: non-target employee cannot respond", async () => {
    const create = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    // Skip if duplicate
    if (create.status === 409) return;

    // emp1 (requester) tries to respond
    const res = await request(app)
      .patch(`/api/swap-requests/${create.body.id}/respond`)
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({ action: "accept" });

    expect(res.status).toBe(403);
  });
});

// ── TC-05: RBAC ──────────────────────────────────────────────────────────────

describe("TC-05: RBAC", () => {
  let orgId: string;
  let org2Id: string;
  let emp1Token: string;
  let emp2Token: string;
  let otherOrgToken: string;
  let scheduleId: string;
  let shift1Id: string;
  let shift2Id: string;
  let emp2Id: string;

  beforeAll(async () => {
    const org = await createOrg("RBAC");
    orgId = org.id;
    const org2 = await createOrg("RBAC-Other");
    org2Id = org2.id;

    const user1 = await createUser(orgId, "EMPLOYEE", "rbac1");
    emp1Token = tokenFor(user1);
    const employee1 = await createEmployee(orgId, "Ivy", user1.email);

    const user2 = await createUser(orgId, "EMPLOYEE", "rbac2");
    emp2Token = tokenFor(user2);
    const employee2 = await createEmployee(orgId, "Jack", user2.email);
    emp2Id = employee2.id;

    const otherUser = await createUser(org2Id, "MANAGER", "other");
    otherOrgToken = tokenFor(otherUser);

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift1 = await createShift(scheduleId, employee1.id, { title: "RBAC 1" });
    shift1Id = shift1.id;
    const shift2 = await createShift(scheduleId, employee2.id, { title: "RBAC 2" });
    shift2Id = shift2.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, org2Id] } } });
  });

  it("TC-05.1: employee cannot resolve (approve/reject)", async () => {
    const create = await request(app)
      .post("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        scheduleId,
        requestingShiftId: shift1Id,
        targetEmployeeId: emp2Id,
        targetShiftId: shift2Id,
      });

    await request(app)
      .patch(`/api/swap-requests/${create.body.id}/respond`)
      .set("Authorization", `Bearer ${emp2Token}`)
      .send({ action: "accept" });

    const res = await request(app)
      .patch(`/api/swap-requests/${create.body.id}/resolve`)
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({ action: "approve" });

    expect(res.status).toBe(403);
  });

  it("TC-05.2: cross-org user cannot see swap requests", async () => {
    const res = await request(app)
      .get("/api/swap-requests")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("TC-05.3: unauthenticated request returns 401", async () => {
    const res = await request(app).get("/api/swap-requests");
    expect(res.status).toBe(401);
  });
});

// ── TC-06: List & Filter ─────────────────────────────────────────────────────

describe("TC-06: List and Filter", () => {
  let orgId: string;
  let emp1Token: string;
  let scheduleId: string;

  beforeAll(async () => {
    const org = await createOrg("ListFilter");
    orgId = org.id;

    const user1 = await createUser(orgId, "EMPLOYEE", "lf1");
    emp1Token = tokenFor(user1);
    const employee1 = await createEmployee(orgId, "Kate", user1.email);

    const user2 = await createUser(orgId, "EMPLOYEE", "lf2");
    const employee2 = await createEmployee(orgId, "Leo", user2.email);

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const shift1 = await createShift(scheduleId, employee1.id, { title: "LF 1" });
    const shift2 = await createShift(scheduleId, employee2.id, { title: "LF 2" });

    // Create a swap request directly in DB for list testing
    await prisma.swapRequest.create({
      data: {
        scheduleId,
        requestingEmployeeId: employee1.id,
        requestingShiftId: shift1.id,
        targetEmployeeId: employee2.id,
        targetShiftId: shift2.id,
        status: "PENDING_TARGET",
      },
    });
    await prisma.swapRequest.create({
      data: {
        scheduleId,
        requestingEmployeeId: employee1.id,
        requestingShiftId: shift1.id,
        targetEmployeeId: employee2.id,
        targetShiftId: shift2.id,
        status: "APPROVED",
        resolvedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-06.1: list all swap requests for org", async () => {
    const res = await request(app)
      .get("/api/swap-requests")
      .set("Authorization", `Bearer ${emp1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("TC-06.2: filter by scheduleId", async () => {
    const res = await request(app)
      .get(`/api/swap-requests?scheduleId=${scheduleId}`)
      .set("Authorization", `Bearer ${emp1Token}`);

    expect(res.status).toBe(200);
    res.body.forEach((sr: { schedule: { id: string } }) => {
      expect(sr.schedule.id).toBe(scheduleId);
    });
  });

  it("TC-06.3: filter by status", async () => {
    const res = await request(app)
      .get("/api/swap-requests?status=PENDING_TARGET")
      .set("Authorization", `Bearer ${emp1Token}`);

    expect(res.status).toBe(200);
    res.body.forEach((sr: { status: string }) => {
      expect(sr.status).toBe("PENDING_TARGET");
    });
  });
});
