/**
 * TIM-74 — QA: Availability tracking test suite
 * Backend API tests for [TIM-33] Availability Tracking
 *
 * Test scope (mirrors TIM-33 acceptance criteria):
 *   - Employee can set/replace recurring weekly availability windows
 *   - Manager+ can view any employee's availability
 *   - Manager week-view aggregates availability across all employees
 *   - Shift conflict detection fires when employee is marked UNAVAILABLE on the shift's day
 *   - Auth guard enforces JWT on all availability routes
 *   - Org isolation: users cannot access other orgs' data
 *
 * Depends on:
 *   - [TIM-63] Backend: Availability API — routes must be added to routes/employee.ts
 *     before these tests pass. Compilation succeeds now because the employee router
 *     is already imported; 404 responses are expected until TIM-63 is merged.
 *
 * Known schema gap (flag for TIM-63):
 *   The current Availability model uses dayOfWeek (Int) and has no date field.
 *   One-off date-specific unavailability exceptions require either:
 *     (a) a migration adding a nullable `date` column to Availability, or
 *     (b) a separate UnavailabilityException model.
 *   Tests for the one-off exception endpoints are skipped with `.todo` until
 *   TIM-63 resolves this and updates the Prisma schema.
 */

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { errorHandler } from "../middleware/errorHandler";
import employeeRoutes from "../routes/employee";
import { employeeAvailabilityRouter } from "../routes/availability";

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    availability: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    shift: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    shiftAssignment: {
      createMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import prisma from "../lib/prisma";

const mockPrisma = prisma as unknown as {
  employee: { [k: string]: jest.Mock };
  availability: { [k: string]: jest.Mock };
  shift: { [k: string]: jest.Mock };
  shiftAssignment: { [k: string]: jest.Mock };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/employees", employeeRoutes);
  app.use("/api/employees/:id", employeeAvailabilityRouter);
  app.use(errorHandler);
  return app;
}

function makeJwt(payload: object) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: "15m" });
}

const adminToken = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
const managerToken = makeJwt({ userId: "user-2", organizationId: "org-1", role: "MANAGER" });
const employeeToken = makeJwt({ userId: "user-3", organizationId: "org-1", role: "EMPLOYEE" });
const otherOrgToken = makeJwt({ userId: "user-4", organizationId: "org-2", role: "MANAGER" });

const baseEmployee = {
  id: "emp-1",
  firstName: "Alice",
  lastName: "Smith",
  email: "alice@example.com",
  phone: null,
  position: "Barista",
  hourlyRate: 15.0,
  organizationId: "org-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// Recurring weekly availability windows
const mondayWindow = {
  id: "avail-1",
  employeeId: "emp-1",
  dayOfWeek: 1, // Monday
  startTime: "09:00",
  endTime: "17:00",
  type: "AVAILABLE",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const fridayUnavailable = {
  id: "avail-2",
  employeeId: "emp-1",
  dayOfWeek: 5, // Friday
  startTime: "00:00",
  endTime: "23:59",
  type: "UNAVAILABLE",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
describe("Auth guard on availability routes", () => {
  const app = createApp();

  it("GET /:id/availability rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/employees/emp-1/availability");
    expect(res.status).toBe(401);
  });

  it("PUT /:id/availability rejects unauthenticated request", async () => {
    const res = await request(app).put("/api/employees/emp-1/availability").send([]);
    expect(res.status).toBe(401);
  });

  it("GET /availability/week rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/employees/availability/week?start=2026-04-07");
    expect(res.status).toBe(401);
  });

  it("rejects a tampered token on availability routes", async () => {
    const res = await request(app)
      .get("/api/employees/emp-1/availability")
      .set("Authorization", "Bearer not.a.valid.token");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/employees/:id/availability — recurring windows
// ---------------------------------------------------------------------------
describe("GET /api/employees/:id/availability", () => {
  const app = createApp();

  it("returns the employee's recurring availability windows", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.findMany.mockResolvedValue([mondayWindow]);

    const res = await request(app)
      .get("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].dayOfWeek).toBe(1);
    expect(res.body[0].startTime).toBe("09:00");
    expect(res.body[0].type).toBe("AVAILABLE");
    // Must scope query to this employee
    expect(mockPrisma.availability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: "emp-1" }) })
    );
  });

  it("returns an empty array when no windows are set", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 404 when employee does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/employees/no-such-id/availability")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when employee belongs to a different org (org isolation)", async () => {
    // org-2 manager cannot see org-1 employee
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
    // Org-scoped lookup must include organizationId
    expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-2" }) })
    );
  });

  it("employee can view their own availability", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.findMany.mockResolvedValue([mondayWindow]);

    const res = await request(app)
      .get("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${employeeToken}`);

    // EMPLOYEE role allowed: own schedule visibility is part of TIM-33 user stories
    expect(res.status).toBe(200);
  });

  it("admin can view any employee's availability", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.findMany.mockResolvedValue([mondayWindow, fridayUnavailable]);

    const res = await request(app)
      .get("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/employees/:id/availability — replace recurring windows
// ---------------------------------------------------------------------------
describe("PUT /api/employees/:id/availability", () => {
  const app = createApp();

  const replacementWindows = [
    { dayOfWeek: 1, startTime: "08:00", endTime: "16:00", type: "AVAILABLE" },
    { dayOfWeek: 3, startTime: "10:00", endTime: "18:00", type: "AVAILABLE" },
  ];

  it("replaces all recurring windows for an employee", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.availability.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.availability.findMany.mockResolvedValue(
      replacementWindows.map((w, i) => ({ ...w, id: `avail-new-${i}`, employeeId: "emp-1" }))
    );

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(replacementWindows);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    // Old windows deleted first
    expect(mockPrisma.availability.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: "emp-1" }) })
    );
    expect(mockPrisma.availability.createMany).toHaveBeenCalled();
  });

  it("accepts an empty array — clears all windows", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.availability.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.availability.findMany.mockResolvedValue([]);

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send([]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockPrisma.availability.deleteMany).toHaveBeenCalled();
  });

  it("returns 404 when employee does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/employees/no-such-id/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(replacementWindows);

    expect(res.status).toBe(404);
    expect(mockPrisma.availability.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 404 on cross-org access attempt", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null); // org filter blocks it

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${otherOrgToken}`)
      .send(replacementWindows);

    expect(res.status).toBe(404);
  });

  it("rejects invalid dayOfWeek (out of 0-6 range)", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send([{ dayOfWeek: 7, startTime: "09:00", endTime: "17:00", type: "AVAILABLE" }]);

    expect(res.status).toBe(400);
  });

  it("rejects invalid type value", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send([{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", type: "MAYBE" }]);

    expect(res.status).toBe(400);
  });

  it("rejects missing startTime", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${managerToken}`)
      .send([{ dayOfWeek: 1, endTime: "17:00", type: "AVAILABLE" }]);

    expect(res.status).toBe(400);
  });

  it("admin can replace availability for any employee", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.availability.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.availability.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.availability.findMany.mockResolvedValue([
      { ...replacementWindows[0], id: "avail-new-1", employeeId: "emp-1" },
    ]);

    const res = await request(app)
      .put("/api/employees/emp-1/availability")
      .set("Authorization", `Bearer ${adminToken}`)
      .send([replacementWindows[0]]);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// One-off unavailability exceptions
// NOTE: These endpoints require schema changes in TIM-63 (no date field exists
// in the current Availability model). Tests are registered as .todo until
// TIM-63 resolves the schema gap.
// ---------------------------------------------------------------------------
describe("POST /api/employees/:id/unavailability — one-off date exceptions", () => {
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 201 when employee adds a one-off unavailability date");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 400 when date field is missing");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 400 when date is in the past");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 404 when employee not found");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("employee can only add exceptions for themselves (RBAC)");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("manager can add exception for any employee in their org");
});

describe("DELETE /api/employees/:id/unavailability/:eid — remove exception", () => {
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 204 when exception removed successfully");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 404 when exception does not exist");
  // eslint-disable-next-line jest/no-todo-tests
  it.todo("returns 404 on cross-org attempt");
});

// ---------------------------------------------------------------------------
// GET /api/employees/availability/week — manager week-view
// ---------------------------------------------------------------------------
describe("GET /api/employees/availability/week", () => {
  const app = createApp();

  it("returns availability summary for all employees for the given week (manager)", async () => {
    const emp2 = { ...baseEmployee, id: "emp-2", firstName: "Bob", lastName: "Jones" };
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee, emp2]);
    mockPrisma.availability.findMany
      .mockResolvedValueOnce([mondayWindow]) // Alice
      .mockResolvedValueOnce([fridayUnavailable]); // Bob

    const res = await request(app)
      .get("/api/employees/availability/week?start=2026-04-07")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    // Response should include per-employee availability
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    // Employees fetched scoped to the caller's org
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-1" }) })
    );
  });

  it("returns 400 when start query param is missing", async () => {
    const res = await request(app)
      .get("/api/employees/availability/week")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 400 when start param is not a valid date", async () => {
    const res = await request(app)
      .get("/api/employees/availability/week?start=not-a-date")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 403 when EMPLOYEE role calls week view", async () => {
    const res = await request(app)
      .get("/api/employees/availability/week?start=2026-04-07")
      .set("Authorization", `Bearer ${employeeToken}`);

    // Week view aggregates all employees — requires MANAGER or ADMIN role
    expect(res.status).toBe(403);
  });

  it("admin can call week view endpoint", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);
    mockPrisma.availability.findMany.mockResolvedValue([mondayWindow]);

    const res = await request(app)
      .get("/api/employees/availability/week?start=2026-04-07")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Conflict detection: availability-aware shift assignment warnings
// Tests the existing GET /api/shifts/:id/conflicts endpoint, which already
// reads Availability records to flag UNAVAILABLE days. These tests verify
// the integration between availability data and conflict detection.
// ---------------------------------------------------------------------------
describe("Shift conflict detection — availability overlap warning", () => {
  const shiftRouter = (() => {
    const r = express.Router();
    // Import and mount the shift routes inline
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shiftRoutes = require("../routes/shift").default;
    return shiftRoutes;
  })();

  function createConflictApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/shifts", shiftRouter);
    app.use(errorHandler);
    return app;
  }

  const fridayShift = {
    id: "shift-1",
    scheduleId: "sched-1",
    employeeId: "emp-1",
    title: "Friday Morning",
    startTime: new Date("2026-04-10T09:00:00Z"), // Friday
    endTime: new Date("2026-04-10T17:00:00Z"),
    location: null,
    role: null,
    requiredHeadcount: 1,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignments: [],
  };

  it("returns unavailable conflict when employee is marked UNAVAILABLE on shift's day", async () => {
    const app = createConflictApp();
    mockPrisma.shift.findFirst
      .mockResolvedValueOnce({ ...fridayShift, assignments: [] }) // main shift fetch
      .mockResolvedValueOnce({ ...fridayShift, assignments: [] }); // second call if needed
    mockPrisma.shift.findMany.mockResolvedValue([]); // no double-booking
    mockPrisma.employee.findMany.mockResolvedValue([
      { ...baseEmployee, availabilities: [fridayUnavailable] },
    ]);

    const res = await request(app)
      .get("/api/shifts/shift-1/conflicts?employeeId=emp-1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0].type).toBe("unavailable");
    expect(res.body.conflicts[0].employeeId).toBe("emp-1");
  });

  it("returns empty conflicts when employee is AVAILABLE on shift's day", async () => {
    const app = createConflictApp();
    // Monday shift, employee has AVAILABLE on Monday
    const mondayShift = {
      ...fridayShift,
      id: "shift-2",
      title: "Monday Morning",
      startTime: new Date("2026-04-07T09:00:00Z"), // Monday
      endTime: new Date("2026-04-07T17:00:00Z"),
    };
    mockPrisma.shift.findFirst.mockResolvedValue({ ...mondayShift, assignments: [] });
    mockPrisma.shift.findMany.mockResolvedValue([]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { ...baseEmployee, availabilities: [mondayWindow] },
    ]);

    const res = await request(app)
      .get("/api/shifts/shift-2/conflicts?employeeId=emp-1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(0);
  });

  it("returns no conflicts when employee has no availability records (assume available)", async () => {
    const app = createConflictApp();
    mockPrisma.shift.findFirst.mockResolvedValue({ ...fridayShift, assignments: [] });
    mockPrisma.shift.findMany.mockResolvedValue([]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { ...baseEmployee, availabilities: [] },
    ]);

    const res = await request(app)
      .get("/api/shifts/shift-1/conflicts?employeeId=emp-1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(0);
  });

  it("returns 404 when shift does not exist", async () => {
    const app = createConflictApp();
    mockPrisma.shift.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/shifts/no-such-shift/conflicts?employeeId=emp-1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });

  it("returns both double-booked and unavailable conflicts simultaneously", async () => {
    const app = createConflictApp();
    const conflictingShift = {
      id: "shift-other",
      title: "Conflicting Shift",
      schedule: { name: "Other Schedule" },
    };
    mockPrisma.shift.findFirst.mockResolvedValue({ ...fridayShift, assignments: [] });
    mockPrisma.shift.findMany.mockResolvedValue([conflictingShift]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { ...baseEmployee, availabilities: [fridayUnavailable] },
    ]);

    const res = await request(app)
      .get("/api/shifts/shift-1/conflicts?employeeId=emp-1")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conflicts.length).toBeGreaterThanOrEqual(2);

    const types = res.body.conflicts.map((c: { type: string }) => c.type);
    expect(types).toContain("double_booked");
    expect(types).toContain("unavailable");
  });

  it("returns 401 when conflicts endpoint called without auth", async () => {
    const app = createConflictApp();
    const res = await request(app).get("/api/shifts/shift-1/conflicts?employeeId=emp-1");
    expect(res.status).toBe(401);
  });
});
