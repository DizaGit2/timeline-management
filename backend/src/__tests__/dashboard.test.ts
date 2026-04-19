/**
 * TIM-163 — QA: Dashboard stats endpoint test suite
 * Subtask of TIM-162 — Fix dashboard: merge stats endpoint and wire frontend to live data
 *
 * Covers GET /api/dashboard/stats endpoint (TIM-148):
 *  TC-DASH-01: MANAGER receives correct stats (scheduleCount, employeeCount, shiftsThisWeek, unfilledShiftsThisWeek)
 *  TC-DASH-02: ADMIN receives correct stats
 *  TC-DASH-03: EMPLOYEE role is denied (403)
 *  TC-DASH-04: Unauthenticated request is denied (401)
 *  TC-DASH-05: Stats reflect only the requesting user's organization (cross-org isolation)
 *  TC-DASH-06: shiftsThisWeek counts only shifts whose startTime falls within the current UTC week
 *  TC-DASH-07: unfilledShiftsThisWeek counts only shifts where assignments < requiredHeadcount
 */

import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

let _ipCounter = 1;
function nextIp(): string {
  return `10.9.${Math.floor(_ipCounter / 255)}.${_ipCounter++ % 255 + 1}`;
}

async function createOrg(label = "Dash") {
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
      isActive: true,
    },
  });
}

async function loginAs(email: string, password = "password"): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", nextIp())
    .send({ email, password });
  return res.body.accessToken as string;
}

async function createSchedule(orgId: string, label = "") {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  return prisma.schedule.create({
    data: {
      name: `Schedule ${label} ${Date.now()}`,
      startDate: start,
      endDate: end,
      organizationId: orgId,
    },
  });
}

async function createEmployee(orgId: string, label = "") {
  const tag = `${label}-${Date.now()}`;
  return prisma.employee.create({
    data: {
      firstName: `Emp`,
      lastName: `${label} ${Date.now()}`,
      email: `${tag}@test-dash.com`,
      organizationId: orgId,
      isActive: true,
    },
  });
}

/** Returns a Date for this Monday (UTC) + offsetDays */
function thisWeekDay(offsetDays: number): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff)
  );
  monday.setUTCDate(monday.getUTCDate() + offsetDays);
  return monday;
}

async function createShift(
  scheduleId: string,
  startTime: Date,
  requiredHeadcount = 1
) {
  const endTime = new Date(startTime);
  endTime.setUTCHours(endTime.getUTCHours() + 8);
  return prisma.shift.create({
    data: {
      scheduleId,
      title: `Shift ${Date.now()}`,
      startTime,
      endTime,
      requiredHeadcount,
    },
  });
}

async function assignEmployee(shiftId: string, employeeId: string) {
  return prisma.shiftAssignment.create({
    data: { shiftId, employeeId },
  });
}

// ── TC-DASH-01: MANAGER receives correct stats ────────────────────────────────

describe("TC-DASH-01: GET /api/dashboard/stats — MANAGER happy path", () => {
  let orgId: string;
  let token: string;

  beforeAll(async () => {
    const org = await createOrg("Mgr");
    orgId = org.id;
    const mgr = await createUser(orgId, "MANAGER", "mgr01");
    token = await loginAs(mgr.email);

    // 2 schedules, 3 active employees, 2 shifts this week (1 unfilled)
    const [sch1, sch2] = await Promise.all([
      createSchedule(orgId, "A"),
      createSchedule(orgId, "B"),
    ]);
    const [emp1, emp2, emp3] = await Promise.all([
      createEmployee(orgId, "e1"),
      createEmployee(orgId, "e2"),
      createEmployee(orgId, "e3"),
    ]);

    const shift1 = await createShift(sch1.id, thisWeekDay(0), 1); // requiredHeadcount=1
    const shift2 = await createShift(sch2.id, thisWeekDay(1), 2); // requiredHeadcount=2, only 1 assigned → unfilled
    await createShift(sch1.id, new Date("2020-01-01T09:00:00Z"), 1); // past shift, not this week

    await assignEmployee(shift1.id, emp1.id); // shift1 fully covered
    await assignEmployee(shift2.id, emp2.id); // shift2 has 1/2 → unfilled
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 200 with correct stat fields", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      scheduleCount: 2,
      employeeCount: 3,
      shiftsThisWeek: 2,
      unfilledShiftsThisWeek: 1,
    });
  });
});

// ── TC-DASH-02: ADMIN receives correct stats ──────────────────────────────────

describe("TC-DASH-02: GET /api/dashboard/stats — ADMIN happy path", () => {
  let orgId: string;
  let token: string;

  beforeAll(async () => {
    const org = await createOrg("Adm");
    orgId = org.id;
    const admin = await createUser(orgId, "ADMIN", "adm01");
    token = await loginAs(admin.email);

    const sch = await createSchedule(orgId, "X");
    await createEmployee(orgId, "ea");
    await createShift(sch.id, thisWeekDay(2), 1);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 200 for ADMIN role", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.scheduleCount).toBe("number");
    expect(typeof res.body.employeeCount).toBe("number");
    expect(typeof res.body.shiftsThisWeek).toBe("number");
    expect(typeof res.body.unfilledShiftsThisWeek).toBe("number");
  });
});

// ── TC-DASH-03: EMPLOYEE is denied ───────────────────────────────────────────

describe("TC-DASH-03: GET /api/dashboard/stats — EMPLOYEE denied", () => {
  let orgId: string;
  let token: string;

  beforeAll(async () => {
    const org = await createOrg("Emp");
    orgId = org.id;
    const emp = await createUser(orgId, "EMPLOYEE", "emp01");
    token = await loginAs(emp.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("returns 403 for EMPLOYEE role", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ── TC-DASH-04: Unauthenticated denied ───────────────────────────────────────

describe("TC-DASH-04: GET /api/dashboard/stats — unauthenticated", () => {
  it("returns 401 with no token", async () => {
    const res = await request(app).get("/api/dashboard/stats");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });
});

// ── TC-DASH-05: Cross-org isolation ──────────────────────────────────────────

describe("TC-DASH-05: GET /api/dashboard/stats — cross-org isolation", () => {
  let orgAId: string;
  let orgBId: string;
  let tokenA: string;

  beforeAll(async () => {
    const [orgA, orgB] = await Promise.all([
      createOrg("IsoA"),
      createOrg("IsoB"),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;

    const mgrA = await createUser(orgAId, "MANAGER", "isoA");
    tokenA = await loginAs(mgrA.email);

    // Org A: 1 schedule, 1 employee
    await createSchedule(orgAId, "A");
    await createEmployee(orgAId, "ea");

    // Org B: 3 schedules, 5 employees — should NOT appear in Org A stats
    await Promise.all([
      createSchedule(orgBId, "B1"),
      createSchedule(orgBId, "B2"),
      createSchedule(orgBId, "B3"),
    ]);
    await Promise.all([
      createEmployee(orgBId, "eb1"),
      createEmployee(orgBId, "eb2"),
      createEmployee(orgBId, "eb3"),
      createEmployee(orgBId, "eb4"),
      createEmployee(orgBId, "eb5"),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      prisma.organization.deleteMany({ where: { id: orgAId } }),
      prisma.organization.deleteMany({ where: { id: orgBId } }),
    ]);
  });

  it("only returns stats for the requester's organization", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.scheduleCount).toBe(1);
    expect(res.body.employeeCount).toBe(1);
  });
});

// ── TC-DASH-06: shiftsThisWeek only counts current week ───────────────────────

describe("TC-DASH-06: GET /api/dashboard/stats — shiftsThisWeek date boundary", () => {
  let orgId: string;
  let token: string;

  beforeAll(async () => {
    const org = await createOrg("Week");
    orgId = org.id;
    const mgr = await createUser(orgId, "MANAGER", "wk01");
    token = await loginAs(mgr.email);

    const sch = await createSchedule(orgId, "W");

    // 1 shift this week
    await createShift(sch.id, thisWeekDay(0), 1);
    // 1 shift last week (before Monday)
    const lastWeek = thisWeekDay(-7);
    await createShift(sch.id, lastWeek, 1);
    // 1 shift next week (after Sunday)
    const nextWeek = thisWeekDay(7);
    await createShift(sch.id, nextWeek, 1);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("counts only shifts whose startTime is within this week", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.shiftsThisWeek).toBe(1);
  });
});

// ── TC-DASH-07: unfilledShiftsThisWeek logic ──────────────────────────────────

describe("TC-DASH-07: GET /api/dashboard/stats — unfilledShiftsThisWeek", () => {
  let orgId: string;
  let token: string;

  beforeAll(async () => {
    const org = await createOrg("Unfilled");
    orgId = org.id;
    const mgr = await createUser(orgId, "MANAGER", "uf01");
    token = await loginAs(mgr.email);

    const sch = await createSchedule(orgId, "U");
    const [emp1, emp2, emp3] = await Promise.all([
      createEmployee(orgId, "uf-e1"),
      createEmployee(orgId, "uf-e2"),
      createEmployee(orgId, "uf-e3"),
    ]);

    // shift fully covered: requiredHeadcount=2, assigned=2
    const s1 = await createShift(sch.id, thisWeekDay(0), 2);
    await assignEmployee(s1.id, emp1.id);
    await assignEmployee(s1.id, emp2.id);

    // shift unfilled: requiredHeadcount=2, assigned=1
    const s2 = await createShift(sch.id, thisWeekDay(1), 2);
    await assignEmployee(s2.id, emp3.id);

    // shift with requiredHeadcount=0 (no staffing needed) — not unfilled
    await createShift(sch.id, thisWeekDay(2), 0);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("counts only shifts where assignments < requiredHeadcount (and requiredHeadcount > 0)", async () => {
    const res = await request(app)
      .get("/api/dashboard/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.shiftsThisWeek).toBe(3);
    expect(res.body.unfilledShiftsThisWeek).toBe(1);
  });
});
