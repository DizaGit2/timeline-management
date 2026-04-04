/**
 * TIM-77 — QA: Reporting and export test suite
 * Backend API tests for /api/reports endpoints
 *
 * Test scope mirrors TIM-38 acceptance criteria:
 *  - GET /api/reports/hours    — hours summary shows correct totals per employee
 *  - GET /api/reports/unfilled — unfilled shifts report shows correct gaps
 *  - GET /api/reports/schedule/csv — CSV download with correct columns and data
 *  - All three routes require MANAGER or ADMIN role (EMPLOYEE gets 403)
 *  - All three routes require a valid JWT (401 without token)
 *
 * NOTE — Known gaps:
 *  - PDF export (mentioned in TIM-38 acceptance criteria) is not yet implemented;
 *    no /api/reports/schedule/pdf route exists. This should be filed against TIM-38.
 */

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { errorHandler } from "../middleware/errorHandler";
import reportRoutes from "../routes/report";

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    shift: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from "../lib/prisma";

const mockPrisma = prisma as unknown as {
  shift: { findMany: jest.Mock };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/reports", reportRoutes);
  app.use(errorHandler);
  return app;
}

function makeJwt(payload: object) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: "15m" });
}

const adminToken = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
const managerToken = makeJwt({ userId: "user-2", organizationId: "org-1", role: "MANAGER" });
const employeeToken = makeJwt({ userId: "user-3", organizationId: "org-1", role: "EMPLOYEE" });

// Reusable shift factories
function makeShift(overrides: Partial<ReturnType<typeof baseShift>> = {}) {
  return { ...baseShift(), ...overrides };
}

function baseShift() {
  return {
    id: "shift-1",
    title: "Morning Shift",
    startTime: new Date("2026-03-02T08:00:00.000Z"),
    endTime: new Date("2026-03-02T16:00:00.000Z"),
    location: "Main Floor",
    requiredHeadcount: 2,
    employeeId: null as string | null,
    employee: null as { id: string; firstName: string; lastName: string } | null,
    assignments: [] as Array<{
      employeeId: string;
      employee: { id: string; firstName: string; lastName: string };
    }>,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/reports/hours
// ---------------------------------------------------------------------------
describe("GET /api/reports/hours", () => {
  const app = createApp();

  it("returns 401 when no auth token provided", async () => {
    const res = await request(app).get("/api/reports/hours?weekStart=2026-03-02");
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE role", async () => {
    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when weekStart is missing", async () => {
    const res = await request(app)
      .get("/api/reports/hours")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  it("returns empty array when no shifts exist in the week", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns correct hours for a single employee via ShiftAssignment", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        assignments: [
          { employeeId: "emp-1", employee: { id: "emp-1", firstName: "Alice", lastName: "Smith" } },
        ],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      employeeId: "emp-1",
      employeeName: "Alice Smith",
      totalHours: 8,
      shiftCount: 1,
    });
  });

  it("aggregates hours across multiple shifts for the same employee", async () => {
    const emp = { id: "emp-1", firstName: "Alice", lastName: "Smith" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        id: "shift-1",
        startTime: new Date("2026-03-02T08:00:00.000Z"),
        endTime: new Date("2026-03-02T12:00:00.000Z"), // 4 hrs
        assignments: [{ employeeId: "emp-1", employee: emp }],
      }),
      makeShift({
        id: "shift-2",
        startTime: new Date("2026-03-03T14:00:00.000Z"),
        endTime: new Date("2026-03-03T20:00:00.000Z"), // 6 hrs
        assignments: [{ employeeId: "emp-1", employee: emp }],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ employeeId: "emp-1", totalHours: 10, shiftCount: 2 });
  });

  it("counts hours for multiple employees separately", async () => {
    const alice = { id: "emp-1", firstName: "Alice", lastName: "Smith" };
    const bob = { id: "emp-2", firstName: "Bob", lastName: "Jones" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        assignments: [
          { employeeId: "emp-1", employee: alice },
          { employeeId: "emp-2", employee: bob },
        ],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const names = res.body.map((r: { employeeName: string }) => r.employeeName);
    // alphabetically sorted
    expect(names).toEqual(["Alice Smith", "Bob Jones"]);
    expect(res.body[0].totalHours).toBe(8);
    expect(res.body[1].totalHours).toBe(8);
  });

  it("counts hours for legacy direct-employee shift (no assignment record)", async () => {
    const emp = { id: "emp-1", firstName: "Alice", lastName: "Smith" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({ employee: emp, assignments: [] }),
    ]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ employeeId: "emp-1", totalHours: 8, shiftCount: 1 });
  });

  it("does not double-count when employee appears in both assignment and legacy field", async () => {
    const emp = { id: "emp-1", firstName: "Alice", lastName: "Smith" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        employee: emp,
        assignments: [{ employeeId: "emp-1", employee: emp }],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shiftCount).toBe(1);
    expect(res.body[0].totalHours).toBe(8);
  });

  it("ADMIN role can also access the hours report", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("returns results sorted alphabetically by employee name", async () => {
    const shifts = [
      makeShift({
        id: "s1",
        assignments: [{ employeeId: "emp-3", employee: { id: "emp-3", firstName: "Zoe", lastName: "Adams" } }],
      }),
      makeShift({
        id: "s2",
        assignments: [{ employeeId: "emp-1", employee: { id: "emp-1", firstName: "Alice", lastName: "Smith" } }],
      }),
      makeShift({
        id: "s3",
        assignments: [{ employeeId: "emp-2", employee: { id: "emp-2", firstName: "Bob", lastName: "Jones" } }],
      }),
    ];
    mockPrisma.shift.findMany.mockResolvedValue(shifts);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    const names = res.body.map((r: { employeeName: string }) => r.employeeName);
    expect(names).toEqual(["Alice Smith", "Bob Jones", "Zoe Adams"]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reports/unfilled
// ---------------------------------------------------------------------------
describe("GET /api/reports/unfilled", () => {
  const app = createApp();

  it("returns 401 when no auth token provided", async () => {
    const res = await request(app).get("/api/reports/unfilled?weekStart=2026-03-02");
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE role", async () => {
    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when weekStart is missing", async () => {
    const res = await request(app)
      .get("/api/reports/unfilled")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  it("returns empty array when all shifts are fully staffed", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        requiredHeadcount: 1,
        assignments: [{ employeeId: "emp-1", employee: { id: "emp-1", firstName: "Alice", lastName: "Smith" } }],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns unfilled shift when assigned < required headcount", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({ requiredHeadcount: 3, assignments: [] }),
    ]);

    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      shiftId: "shift-1",
      title: "Morning Shift",
      required: 3,
      assigned: 0,
    });
  });

  it("includes partially-filled shifts in unfilled report", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        requiredHeadcount: 3,
        assignments: [{ employeeId: "emp-1", employee: { id: "emp-1", firstName: "Alice", lastName: "Smith" } }],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ required: 3, assigned: 1 });
  });

  it("returns the date field in YYYY-MM-DD format", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({ startTime: new Date("2026-03-02T08:00:00.000Z"), requiredHeadcount: 2, assignments: [] }),
    ]);

    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].date).toBe("2026-03-02");
  });

  it("returns empty array when no shifts exist for the week", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filters out shifts that are exactly at required headcount", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        id: "shift-full",
        requiredHeadcount: 2,
        assignments: [
          { employeeId: "emp-1", employee: { id: "emp-1", firstName: "Alice", lastName: "Smith" } },
          { employeeId: "emp-2", employee: { id: "emp-2", firstName: "Bob", lastName: "Jones" } },
        ],
      }),
      makeShift({
        id: "shift-empty",
        title: "Evening Shift",
        requiredHeadcount: 1,
        assignments: [],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shiftId).toBe("shift-empty");
  });

  it("ADMIN role can also access the unfilled report", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/unfilled?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reports/schedule/csv
// ---------------------------------------------------------------------------
describe("GET /api/reports/schedule/csv", () => {
  const app = createApp();

  it("returns 401 when no auth token provided", async () => {
    const res = await request(app).get("/api/reports/schedule/csv?weekStart=2026-03-02");
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE role", async () => {
    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when weekStart is missing", async () => {
    const res = await request(app)
      .get("/api/reports/schedule/csv")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  it("returns text/csv content type", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });

  it("sets Content-Disposition header with weekStart filename", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("schedule-2026-03-02.csv");
  });

  it("includes correct header row columns", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);
    const lines = res.text.split("\n");
    expect(lines[0]).toBe("Employee,Shift Title,Date,Start Time,End Time,Hours,Location");
  });

  it("returns only the header row when no shifts exist", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);
    const lines = res.text.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it("generates a data row for a single assigned employee", async () => {
    const emp = { id: "emp-1", firstName: "Alice", lastName: "Smith" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        startTime: new Date("2026-03-02T08:00:00.000Z"),
        endTime: new Date("2026-03-02T16:00:00.000Z"),
        location: "Main Floor",
        assignments: [{ employeeId: "emp-1", employee: emp }],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    const lines = res.text.split("\n");
    expect(lines).toHaveLength(2);
    const data = lines[1].split(",");
    expect(data[0]).toBe("Alice Smith");
    expect(data[1]).toBe("Morning Shift");
    expect(data[2]).toBe("2026-03-02");
    expect(data[3]).toBe("08:00");
    expect(data[4]).toBe("16:00");
    expect(data[5]).toBe("8.00");
    expect(data[6]).toBe("Main Floor");
  });

  it("generates a row per assigned employee for a multi-employee shift", async () => {
    const alice = { id: "emp-1", firstName: "Alice", lastName: "Smith" };
    const bob = { id: "emp-2", firstName: "Bob", lastName: "Jones" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        assignments: [
          { employeeId: "emp-1", employee: alice },
          { employeeId: "emp-2", employee: bob },
        ],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    const lines = res.text.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain("Alice Smith");
    expect(lines[2]).toContain("Bob Jones");
  });

  it("writes 'Unassigned' for shifts with no employee", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({ assignments: [], employee: null }),
    ]);

    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    const lines = res.text.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith("Unassigned")).toBe(true);
  });

  it("quotes CSV fields that contain commas", async () => {
    const emp = { id: "emp-1", firstName: "Alice, Jr.", lastName: "Smith" };
    mockPrisma.shift.findMany.mockResolvedValue([
      makeShift({
        title: "Shift, Main",
        location: "Floor, East",
        assignments: [{ employeeId: "emp-1", employee: emp }],
      }),
    ]);

    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${managerToken}`);

    const dataLine = res.text.split("\n")[1];
    // Employee name has a comma — must be quoted
    expect(dataLine).toContain('"Alice, Jr. Smith"');
    // Shift title has a comma — must be quoted
    expect(dataLine).toContain('"Shift, Main"');
    // Location has a comma — must be quoted
    expect(dataLine).toContain('"Floor, East"');
  });

  it("ADMIN role can also download the CSV", async () => {
    mockPrisma.shift.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/reports/schedule/csv?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
