/**
 * TIM-73 — QA: Employee management test suite
 * Backend API tests: /api/employees CRUD + org isolation
 *
 * Test scope mirrors TIM-32 acceptance criteria:
 *  - CRUD: create, read, update, delete
 *  - Org isolation: users see only their own organisation's employees
 *  - Auth: all routes require a valid JWT
 *  - Validation: required fields enforced
 *
 * NOTE — Known gaps (filed as bugs against TIM-32):
 *  - Employee deactivate/reactivate not implemented (no isActive field on Employee model)
 *  - Search/filter by name, email, or status not implemented in GET /api/employees
 *  - RBAC: EMPLOYEE role can currently access all employee management endpoints
 *    (routes only use authGuard, no requireRole restriction)
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
      expect.objectContaining({ where: { organizationId: "org-1" } })
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
      expect.objectContaining({ where: { organizationId: "org-2" } })
    );
  });

  // RBAC gap: employee role should not be able to list employees per TIM-32 spec.
  // Currently the route has no role restriction — this test documents current (incorrect) behaviour.
  it("EMPLOYEE role can currently access the list endpoint (known RBAC gap)", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([baseEmployee]);

    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`);

    // When the RBAC restriction is added this should become 403.
    expect(res.status).toBe(200);
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
    mockPrisma.employee.delete.mockResolvedValue(baseEmployee);

    const res = await request(app)
      .delete("/api/employees/emp-1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(mockPrisma.employee.delete).toHaveBeenCalledWith({ where: { id: "emp-1" } });
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
