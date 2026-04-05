/**
 * TIM-113 — QA Tester 1: Employee management test suite
 * Backend API tests: /api/employees CRUD + org isolation + soft delete/reactivate + search/filter
 *
 * Test scope:
 *  - CRUD: create, read, update, soft-delete
 *  - Org isolation: users see only their own organisation's employees
 *  - Auth: all routes require a valid JWT
 *  - Validation: required fields enforced, email format, hourlyRate positive
 *  - RBAC: EMPLOYEE role blocked from all employee management endpoints;
 *          reactivate is ADMIN-only
 *  - Soft delete / reactivate: DELETE sets isActive=false; POST /:id/reactivate re-enables
 *  - GET /inactive: returns only inactive employees
 *  - Search/filter: ?search=, ?status=active|inactive query params
 */

import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { errorHandler } from "../middleware/errorHandler";
import employeeRoutes from "../routes/employee";

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
  },
}));

import prisma from "../lib/prisma";

const mockPrisma = prisma as unknown as {
  employee: { [k: string]: jest.Mock };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/employees", employeeRoutes);
  app.use(errorHandler);
  return app;
}

function makeJwt(payload: object) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: "15m" });
}

const adminToken = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
const managerToken = makeJwt({ userId: "user-2", organizationId: "org-1", role: "MANAGER" });
const employeeToken = makeJwt({ userId: "user-3", organizationId: "org-1", role: "EMPLOYEE" });
const otherOrgToken = makeJwt({ userId: "user-4", organizationId: "org-2", role: "ADMIN" });

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

const otherOrgEmployee = { ...baseEmployee, id: "emp-2", organizationId: "org-2" };

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
describe("Auth guard on all employee routes", () => {
  const app = createApp();

  it("GET / rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(401);
  });

  it("GET /:id rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/employees/emp-1");
    expect(res.status).toBe(401);
  });

  it("POST / rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/employees").send({
      firstName: "Bob",
      lastName: "Jones",
    });
    expect(res.status).toBe(401);
  });

  it("PUT /:id rejects unauthenticated request", async () => {
    const res = await request(app).put("/api/employees/emp-1").send({ firstName: "Bobby" });
    expect(res.status).toBe(401);
  });

  it("DELETE /:id rejects unauthenticated request", async () => {
    const res = await request(app).delete("/api/employees/emp-1");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid token", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/employees — list
// ---------------------------------------------------------------------------
describe("GET /api/employees", () => {
  const app = createApp();

  it("returns employees for the authenticated user's org", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("emp-1");
    // Verify the query is scoped to the caller's org
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-1" }) })
    );
  });

  it("returns an empty list when org has no employees", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("org-2 admin only sees org-2 employees (isolation)", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([otherOrgEmployee]);

    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-2" }) })
    );
  });

  it("EMPLOYEE role cannot access the list endpoint (RBAC enforced)", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/employees/:id — single employee
// ---------------------------------------------------------------------------
describe("GET /api/employees/:id", () => {
  const app = createApp();

  it("returns the employee when found in the same org", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({
      ...baseEmployee,
      shifts: [],
      availabilities: [],
    });

    const res = await request(app)
      .get("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("emp-1");
    // Ensure org-scoped lookup
    expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-1", organizationId: "org-1" },
      })
    );
  });

  it("returns 404 when employee does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/employees/no-such-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when employee belongs to a different org (cross-org isolation)", async () => {
    // org-2 user attempts to fetch org-1 employee — findFirst returns null due to org scoping
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/employees/emp-1")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
    expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "emp-1", organizationId: "org-2" },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/employees — create
// ---------------------------------------------------------------------------
describe("POST /api/employees", () => {
  const app = createApp();

  it("creates an employee with all required fields", async () => {
    mockPrisma.employee.create.mockResolvedValue(baseEmployee);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Alice", lastName: "Smith" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("emp-1");
    expect(mockPrisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "org-1" }),
      })
    );
  });

  it("creates an employee with all optional fields", async () => {
    const full = {
      ...baseEmployee,
      email: "alice@example.com",
      phone: "555-1234",
      position: "Barista",
      hourlyRate: 15.0,
    };
    mockPrisma.employee.create.mockResolvedValue(full);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        phone: "555-1234",
        position: "Barista",
        hourlyRate: 15.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.position).toBe("Barista");
    expect(res.body.hourlyRate).toBe(15.0);
  });

  it("rejects missing firstName", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ lastName: "Smith" });

    expect(res.status).toBe(400);
  });

  it("rejects missing lastName", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Alice" });

    expect(res.status).toBe(400);
  });

  it("rejects empty firstName", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "", lastName: "Smith" });

    expect(res.status).toBe(400);
  });

  it("rejects invalid email format", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Alice", lastName: "Smith", email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("rejects negative hourlyRate", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Alice", lastName: "Smith", hourlyRate: -5 });

    expect(res.status).toBe(400);
  });

  it("manager can create an employee", async () => {
    mockPrisma.employee.create.mockResolvedValue(baseEmployee);

    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ firstName: "Alice", lastName: "Smith" });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/employees/:id — update
// ---------------------------------------------------------------------------
describe("PUT /api/employees/:id", () => {
  const app = createApp();

  it("updates allowed fields on an existing employee", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.employee.update.mockResolvedValue({ ...baseEmployee, position: "Supervisor" });

    const res = await request(app)
      .put("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ position: "Supervisor" });

    expect(res.status).toBe(200);
    expect(res.body.position).toBe("Supervisor");
  });

  it("returns 404 when employee does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/employees/no-such-id")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ position: "Supervisor" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when employee belongs to a different org (cross-org isolation)", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null); // org filter mismatch

    const res = await request(app)
      .put("/api/employees/emp-1")
      .set("Authorization", `Bearer ${otherOrgToken}`)
      .send({ position: "Supervisor" });

    expect(res.status).toBe(404);
  });

  it("rejects invalid email on update", async () => {
    const res = await request(app)
      .put("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("rejects negative hourlyRate on update", async () => {
    const res = await request(app)
      .put("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ hourlyRate: -1 });

    expect(res.status).toBe(400);
  });

  it("partial update — only provided fields are changed", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    const updated = { ...baseEmployee, hourlyRate: 20.0 };
    mockPrisma.employee.update.mockResolvedValue(updated);

    const res = await request(app)
      .put("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ hourlyRate: 20.0 });

    expect(res.status).toBe(200);
    expect(res.body.hourlyRate).toBe(20.0);
    // firstName unchanged
    expect(res.body.firstName).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/employees/:id
// ---------------------------------------------------------------------------
describe("DELETE /api/employees/:id", () => {
  const app = createApp();

  it("deletes an existing employee and returns 204", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(baseEmployee);
    mockPrisma.employee.update.mockResolvedValue({ ...baseEmployee, isActive: false });

    const res = await request(app)
      .delete("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: "emp-1" },
      data: { isActive: false },
    });
  });

  it("returns 404 when employee does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/employees/no-such-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when employee belongs to a different org (cross-org isolation)", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/employees/emp-1")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/employees/inactive
// ---------------------------------------------------------------------------
describe("GET /api/employees/inactive", () => {
  const app = createApp();

  const inactiveEmployee = { ...baseEmployee, id: "emp-inactive", isActive: false };

  it("returns inactive employees for the authenticated org", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([inactiveEmployee]);

    const res = await request(app)
      .get("/api/employees/inactive")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", isActive: false },
      })
    );
  });

  it("returns empty list when all employees are active", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/employees/inactive")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("EMPLOYEE role cannot access inactive list (RBAC enforced)", async () => {
    const res = await request(app)
      .get("/api/employees/inactive")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/employees/inactive");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/employees/:id/reactivate
// ---------------------------------------------------------------------------
describe("POST /api/employees/:id/reactivate", () => {
  const app = createApp();

  const inactiveEmployee = { ...baseEmployee, isActive: false };
  const reactivatedEmployee = { ...baseEmployee, isActive: true };

  it("reactivates an inactive employee (admin only)", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(inactiveEmployee);
    mockPrisma.employee.update.mockResolvedValue(reactivatedEmployee);

    const res = await request(app)
      .post("/api/employees/emp-1/reactivate")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: "emp-1" },
      data: { isActive: true },
    });
  });

  it("returns 400 when employee is already active", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ ...baseEmployee, isActive: true });

    const res = await request(app)
      .post("/api/employees/emp-1/reactivate")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 when employee does not exist", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/employees/no-such-id/reactivate")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-org access attempt", async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/employees/emp-1/reactivate")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
  });

  it("MANAGER role cannot reactivate (ADMIN-only endpoint)", async () => {
    const res = await request(app)
      .post("/api/employees/emp-1/reactivate")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });

  it("EMPLOYEE role cannot reactivate (ADMIN-only endpoint)", async () => {
    const res = await request(app)
      .post("/api/employees/emp-1/reactivate")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/employees/emp-1/reactivate");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/employees — search & filter query params
// ---------------------------------------------------------------------------
describe("GET /api/employees — search and filter", () => {
  const app = createApp();

  it("passes search param to prisma query", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    const res = await request(app)
      .get("/api/employees?search=alice")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ firstName: expect.objectContaining({ contains: "alice" }) }),
            expect.objectContaining({ email: expect.objectContaining({ contains: "alice" }) }),
          ]),
        }),
      })
    );
  });

  it("filters active employees when status=active", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    const res = await request(app)
      .get("/api/employees?status=active")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("filters inactive employees when status=inactive", async () => {
    const inactive = { ...baseEmployee, isActive: false };
    mockPrisma.employee.findMany.mockResolvedValue([inactive]);

    const res = await request(app)
      .get("/api/employees?status=inactive")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it("default (no status param) filters to active only", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("includeInactive=true returns all employees (no isActive filter)", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    await request(app)
      .get("/api/employees?includeInactive=true")
      .set("Authorization", `Bearer ${adminToken}`);

    const call = mockPrisma.employee.findMany.mock.calls[0][0];
    // isActive should not be present when includeInactive=true with no explicit status
    expect(call.where).not.toHaveProperty("isActive");
  });

  it("search combined with status filter passes both to prisma", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    await request(app)
      .get("/api/employees?search=alice&status=active")
      .set("Authorization", `Bearer ${adminToken}`);

    const call = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(call.where).toHaveProperty("isActive", true);
    expect(call.where).toHaveProperty("OR");
  });
});
