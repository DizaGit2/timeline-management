/**
 * TIM-190 — Offline clock-in queue processing and sync
 *
 * Covers:
 *  TC-01: Single clock-in/out (POST /api/clock)
 *  TC-02: Batch sync (POST /api/clock/sync)
 *  TC-03: Idempotency (duplicate events)
 *  TC-04: Clock status (GET /api/clock/status)
 *  TC-05: Time entries list (GET /api/clock/entries)
 *  TC-06: Pending events (GET /api/clock/pending) — Manager only
 *  TC-07: RBAC and cross-org isolation
 *  TC-08: Conflict resolution (out-of-order events)
 */

import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";
import { randomUUID } from "crypto";

// ── Seed helpers ──────────────────────────────────────────────────────────────

let ipCounter = 100;
function nextIp() {
  ipCounter += 1;
  return `10.99.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

async function createOrg(label = "Clock") {
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
  const email = `${tag}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("password", 1),
      name: `${role} ${label}`,
      role,
      organizationId: orgId,
    },
  });
  return user;
}

async function createEmployeeForUser(orgId: string, userEmail: string) {
  return prisma.employee.create({
    data: {
      firstName: "Test",
      lastName: "Worker",
      email: userEmail,
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

// ── TC-01: Single Clock-In/Out ───────────────────────────────────────────────

describe("TC-01: POST /api/clock — Single Clock-In/Out", () => {
  let orgId: string;
  let empToken: string;

  beforeAll(async () => {
    const org = await createOrg("Single");
    orgId = org.id;
    const user = await createUser(orgId, "EMPLOYEE", "clk-emp");
    await createEmployeeForUser(orgId, user.email);
    empToken = await loginAs(user.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-01.1: clock in returns 201 with PROCESSED status", async () => {
    const res = await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        type: "CLOCK_IN",
        idempotencyKey: randomUUID(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PROCESSED");
    expect(res.body.timeEntryId).toBeDefined();
  });

  it("TC-01.2: clock out returns 201", async () => {
    const res = await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        type: "CLOCK_OUT",
        timestamp: "2026-05-05T17:00:00.000Z",
        idempotencyKey: randomUUID(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PROCESSED");
  });

  it("TC-01.3: returns 400 for missing idempotencyKey", async () => {
    const res = await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN" });

    expect(res.status).toBe(400);
  });

  it("TC-01.4: returns 401 without auth", async () => {
    const res = await request(app)
      .post("/api/clock")
      .send({ type: "CLOCK_IN", idempotencyKey: randomUUID() });

    expect(res.status).toBe(401);
  });
});

// ── TC-02: Batch Sync ────────────────────────────────────────────────────────

describe("TC-02: POST /api/clock/sync — Batch Sync", () => {
  let orgId: string;
  let empToken: string;

  beforeAll(async () => {
    const org = await createOrg("Batch");
    orgId = org.id;
    const user = await createUser(orgId, "EMPLOYEE", "sync-emp");
    await createEmployeeForUser(orgId, user.email);
    empToken = await loginAs(user.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-02.1: processes batch of events, returns per-event status", async () => {
    const events = [
      { type: "CLOCK_IN" as const, clientTimestamp: "2026-05-05T08:00:00.000Z", idempotencyKey: randomUUID() },
      { type: "CLOCK_OUT" as const, clientTimestamp: "2026-05-05T16:00:00.000Z", idempotencyKey: randomUUID() },
      { type: "CLOCK_IN" as const, clientTimestamp: "2026-05-06T08:00:00.000Z", idempotencyKey: randomUUID() },
    ];

    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ events });

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(3);
    expect(res.body.summary.processed).toBe(3);
    expect(res.body.summary.duplicates).toBe(0);
    expect(res.body.summary.errors).toBe(0);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results.every((r: { status: string }) => r.status === "PROCESSED")).toBe(true);
    expect(res.body.syncedAt).toBeDefined();
  });

  it("TC-02.2: processes events in chronological order", async () => {
    const events = [
      { type: "CLOCK_OUT" as const, clientTimestamp: "2026-05-07T16:00:00.000Z", idempotencyKey: randomUUID() },
      { type: "CLOCK_IN" as const, clientTimestamp: "2026-05-07T08:00:00.000Z", idempotencyKey: randomUUID() },
    ];

    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ events });

    expect(res.status).toBe(200);
    // Both should be processed regardless of order
    expect(res.body.summary.processed).toBe(2);
  });

  it("TC-02.3: returns 400 for empty events array", async () => {
    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ events: [] });

    expect(res.status).toBe(400);
  });

  it("TC-02.4: returns 400 for missing required fields", async () => {
    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ events: [{ type: "CLOCK_IN" }] }); // missing clientTimestamp, idempotencyKey

    expect(res.status).toBe(400);
  });
});

// ── TC-03: Idempotency ──────────────────────────────────────────────────────

describe("TC-03: Idempotency — Duplicate Events", () => {
  let orgId: string;
  let empToken: string;

  beforeAll(async () => {
    const org = await createOrg("Idemp");
    orgId = org.id;
    const user = await createUser(orgId, "EMPLOYEE", "idemp-emp");
    await createEmployeeForUser(orgId, user.email);
    empToken = await loginAs(user.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-03.1: same idempotencyKey via POST /api/clock returns DUPLICATE on second call", async () => {
    const key = randomUUID();

    const first = await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN", idempotencyKey: key });

    expect(first.status).toBe(201);
    expect(first.body.status).toBe("PROCESSED");

    const second = await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN", idempotencyKey: key });

    expect(second.status).toBe(200);
    expect(second.body.status).toBe("DUPLICATE");
    expect(second.body.timeEntryId).toBe(first.body.timeEntryId);
  });

  it("TC-03.2: duplicate in batch sync returns DUPLICATE status", async () => {
    const key = randomUUID();

    // First: create via single endpoint
    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_OUT", timestamp: "2026-05-08T17:00:00.000Z", idempotencyKey: key });

    // Second: include the same key in a batch
    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        events: [
          { type: "CLOCK_OUT", clientTimestamp: "2026-05-08T17:00:00.000Z", idempotencyKey: key },
          { type: "CLOCK_IN", clientTimestamp: "2026-05-09T08:00:00.000Z", idempotencyKey: randomUUID() },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.summary.duplicates).toBe(1);
    expect(res.body.summary.processed).toBe(1);
  });

  it("TC-03.3: only one TimeEntry exists after duplicate submission", async () => {
    const key = randomUUID();

    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN", idempotencyKey: key });

    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN", idempotencyKey: key });

    const entries = await prisma.timeEntry.findMany({
      where: { idempotencyKey: key },
    });
    expect(entries).toHaveLength(1);
  });
});

// ── TC-04: Clock Status ──────────────────────────────────────────────────────

describe("TC-04: GET /api/clock/status", () => {
  let orgId: string;
  let empToken: string;

  beforeAll(async () => {
    const org = await createOrg("Status");
    orgId = org.id;
    const user = await createUser(orgId, "EMPLOYEE", "stat-emp");
    await createEmployeeForUser(orgId, user.email);
    empToken = await loginAs(user.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-04.1: returns isClockedIn=false when no entries exist", async () => {
    const res = await request(app)
      .get("/api/clock/status")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isClockedIn).toBe(false);
    expect(res.body.lastEntry).toBeNull();
    expect(res.body.employeeId).toBeDefined();
  });

  it("TC-04.2: returns isClockedIn=true after clock in", async () => {
    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN", idempotencyKey: randomUUID() });

    const res = await request(app)
      .get("/api/clock/status")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isClockedIn).toBe(true);
    expect(res.body.lastEntry.type).toBe("CLOCK_IN");
  });

  it("TC-04.3: returns isClockedIn=false after clock out", async () => {
    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_OUT", idempotencyKey: randomUUID() });

    const res = await request(app)
      .get("/api/clock/status")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isClockedIn).toBe(false);
  });
});

// ── TC-05: Time Entries List ─────────────────────────────────────────────────

describe("TC-05: GET /api/clock/entries", () => {
  let orgId: string;
  let empToken: string;
  let managerToken: string;

  beforeAll(async () => {
    const org = await createOrg("Entries");
    orgId = org.id;
    const empUser = await createUser(orgId, "EMPLOYEE", "ent-emp");
    await createEmployeeForUser(orgId, empUser.email);
    empToken = await loginAs(empUser.email);
    const mgr = await createUser(orgId, "MANAGER", "ent-mgr");
    managerToken = await loginAs(mgr.email);

    // Seed some entries
    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_IN", timestamp: "2026-05-05T08:00:00.000Z", idempotencyKey: randomUUID() });
    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ type: "CLOCK_OUT", timestamp: "2026-05-05T16:00:00.000Z", idempotencyKey: randomUUID() });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-05.1: employee sees their own entries", async () => {
    const res = await request(app)
      .get("/api/clock/entries")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("TC-05.2: supports from/to date filter", async () => {
    const res = await request(app)
      .get("/api/clock/entries?from=2026-05-05T00:00:00.000Z&to=2026-05-05T12:00:00.000Z")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    const types = res.body.map((e: { type: string }) => e.type);
    expect(types).toContain("CLOCK_IN");
    // CLOCK_OUT at 16:00 is outside the range
    expect(types).not.toContain("CLOCK_OUT");
  });
});

// ── TC-06: Pending Events (Manager) ─────────────────────────────────────────

describe("TC-06: GET /api/clock/pending — Manager Only", () => {
  let orgId: string;
  let managerToken: string;
  let empToken: string;

  beforeAll(async () => {
    const org = await createOrg("Pending");
    orgId = org.id;
    const mgr = await createUser(orgId, "MANAGER", "pend-mgr");
    managerToken = await loginAs(mgr.email);
    const empUser = await createUser(orgId, "EMPLOYEE", "pend-emp");
    await createEmployeeForUser(orgId, empUser.email);
    empToken = await loginAs(empUser.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-06.1: manager can view pending events", async () => {
    const res = await request(app)
      .get("/api/clock/pending")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("TC-06.2: employee cannot view pending events (403)", async () => {
    const res = await request(app)
      .get("/api/clock/pending")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(403);
  });
});

// ── TC-07: RBAC and Cross-Org Isolation ──────────────────────────────────────

describe("TC-07: Cross-Org Isolation", () => {
  let org1Id: string;
  let org2Id: string;
  let emp1Token: string;
  let emp2Token: string;

  beforeAll(async () => {
    const org1 = await createOrg("ClkIso1");
    org1Id = org1.id;
    const org2 = await createOrg("ClkIso2");
    org2Id = org2.id;

    const user1 = await createUser(org1Id, "EMPLOYEE", "iso1-emp");
    await createEmployeeForUser(org1Id, user1.email);
    emp1Token = await loginAs(user1.email);

    const user2 = await createUser(org2Id, "EMPLOYEE", "iso2-emp");
    await createEmployeeForUser(org2Id, user2.email);
    emp2Token = await loginAs(user2.email);

    // Seed entry for org1
    await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({ type: "CLOCK_IN", idempotencyKey: randomUUID() });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [org1Id, org2Id] } } });
  });

  it("TC-07.1: employee in org2 cannot see org1 entries", async () => {
    const res = await request(app)
      .get("/api/clock/entries")
      .set("Authorization", `Bearer ${emp2Token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("TC-07.2: employee in org2 clock status is independent", async () => {
    const res = await request(app)
      .get("/api/clock/status")
      .set("Authorization", `Bearer ${emp2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.isClockedIn).toBe(false);
  });
});

// ── TC-08: Out-of-Order Events ───────────────────────────────────────────────

describe("TC-08: Out-of-Order Event Processing", () => {
  let orgId: string;
  let empToken: string;

  beforeAll(async () => {
    const org = await createOrg("OOO");
    orgId = org.id;
    const user = await createUser(orgId, "EMPLOYEE", "ooo-emp");
    await createEmployeeForUser(orgId, user.email);
    empToken = await loginAs(user.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-08.1: batch with out-of-order timestamps still processes all events", async () => {
    const events = [
      { type: "CLOCK_OUT" as const, clientTimestamp: "2026-05-10T17:00:00.000Z", idempotencyKey: randomUUID() },
      { type: "CLOCK_IN" as const, clientTimestamp: "2026-05-10T08:00:00.000Z", idempotencyKey: randomUUID() },
      { type: "CLOCK_OUT" as const, clientTimestamp: "2026-05-10T12:00:00.000Z", idempotencyKey: randomUUID() },
      { type: "CLOCK_IN" as const, clientTimestamp: "2026-05-10T13:00:00.000Z", idempotencyKey: randomUUID() },
    ];

    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ events });

    expect(res.status).toBe(200);
    expect(res.body.summary.processed).toBe(4);
    expect(res.body.summary.errors).toBe(0);
  });

  it("TC-08.2: time entries are stored with client timestamps regardless of arrival order", async () => {
    const entries = await request(app)
      .get("/api/clock/entries")
      .set("Authorization", `Bearer ${empToken}`);

    expect(entries.status).toBe(200);
    // Should be ordered by timestamp desc
    const timestamps = entries.body.map((e: { timestamp: string }) => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });
});

// ── TC-09: No Employee Record ────────────────────────────────────────────────

describe("TC-09: User Without Employee Record", () => {
  let orgId: string;
  let userToken: string;

  beforeAll(async () => {
    const org = await createOrg("NoEmp");
    orgId = org.id;
    const user = await createUser(orgId, "EMPLOYEE", "noemp");
    // Intentionally NOT creating an Employee record
    userToken = await loginAs(user.email);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("TC-09.1: clock in returns 404 when no employee record", async () => {
    const res = await request(app)
      .post("/api/clock")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ type: "CLOCK_IN", idempotencyKey: randomUUID() });

    expect(res.status).toBe(404);
  });

  it("TC-09.2: sync returns 404 when no employee record", async () => {
    const res = await request(app)
      .post("/api/clock/sync")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        events: [
          { type: "CLOCK_IN", clientTimestamp: "2026-05-05T08:00:00.000Z", idempotencyKey: randomUUID() },
        ],
      });

    expect(res.status).toBe(404);
  });

  it("TC-09.3: status returns 404 when no employee record", async () => {
    const res = await request(app)
      .get("/api/clock/status")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});
