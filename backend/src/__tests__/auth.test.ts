import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { config } from "../config";
import { errorHandler } from "../middleware/errorHandler";
import authRoutes from "../routes/auth";
import userRoutes from "../routes/user";

// Mock Prisma
jest.mock("../lib/prisma", () => {
  return {
    __esModule: true,
    default: {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    },
  };
});

import prisma from "../lib/prisma";

const mockPrisma = prisma as unknown as {
  user: { [k: string]: jest.Mock };
  organization: { [k: string]: jest.Mock };
  refreshToken: { [k: string]: jest.Mock };
  $transaction: jest.Mock;
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use(errorHandler);
  return app;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function makeJwt(payload: object, secret = config.jwt.secret, expiresIn = "15m") {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

const testUser = {
  id: "user-1",
  email: "admin@test.com",
  passwordHash: "", // set in beforeAll
  name: "Admin",
  role: "ADMIN",
  organizationId: "org-1",
  isActive: true,
  resetToken: null,
  resetTokenExpiresAt: null,
  createdByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: { id: "org-1", name: "Test Org" },
};

beforeAll(async () => {
  testUser.passwordHash = await bcrypt.hash("password123", 12);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  const app = createApp();

  it("registers a new org and admin user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const created = { ...testUser, organization: { id: "org-1", name: "NewOrg" } };
      mockPrisma.user.create.mockResolvedValue(created);
      mockPrisma.organization.update.mockResolvedValue({});
      return cb(mockPrisma);
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app).post("/api/auth/register").send({
      email: "new@test.com",
      password: "password123",
      name: "New User",
      organizationName: "NewOrg",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user).toHaveProperty("role", "ADMIN");
    expect(res.body.organization).toHaveProperty("name", "NewOrg");
  });

  it("rejects duplicate email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(testUser);

    const res = await request(app).post("/api/auth/register").send({
      email: "admin@test.com",
      password: "password123",
      name: "Admin",
      organizationName: "Org",
    });

    expect(res.status).toBe(409);
  });

  it("rejects invalid input", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "short",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  const app = createApp();

  it("logs in with valid credentials", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(testUser);
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user.email).toBe("admin@test.com");
  });

  it("rejects wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(testUser);

    const res = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  it("rejects non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({
      email: "noone@test.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
  });

  it("rejects inactive user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...testUser, isActive: false });

    const res = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  const app = createApp();

  it("issues new tokens with valid refresh token", async () => {
    const payload = { userId: "user-1", organizationId: "org-1", role: "ADMIN" };
    const refreshToken = makeJwt(payload, config.jwt.refreshSecret, "7d");
    const tokenHash = hashToken(refreshToken);

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash,
      revoked: false,
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.refreshToken.update.mockResolvedValue({});
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    // Verify old token was revoked
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { revoked: true } })
    );
  });

  it("rejects revoked refresh token", async () => {
    const payload = { userId: "user-1", organizationId: "org-1", role: "ADMIN" };
    const refreshToken = makeJwt(payload, config.jwt.refreshSecret, "7d");

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken(refreshToken),
      revoked: true,
      expiresAt: new Date(Date.now() + 86400000),
    });

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(401);
  });

  it("rejects expired refresh token in DB", async () => {
    const payload = { userId: "user-1", organizationId: "org-1", role: "ADMIN" };
    const refreshToken = makeJwt(payload, config.jwt.refreshSecret, "7d");

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken(refreshToken),
      revoked: false,
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(401);
  });

  it("rejects invalid JWT refresh token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "invalid-token" });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  const app = createApp();

  it("revokes all refresh tokens", async () => {
    const token = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revoked: false },
      data: { revoked: true },
    });
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/forgot-password", () => {
  const app = createApp();

  it("returns success for existing user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(testUser);
    mockPrisma.user.update.mockResolvedValue({});

    const res = await request(app).post("/api/auth/forgot-password").send({ email: "admin@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("reset link");
    // Verify reset token was stored
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpiresAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns success for non-existent user (no enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/forgot-password").send({ email: "noone@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("reset link");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  const app = createApp();

  it("resets password with valid token", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    mockPrisma.user.findFirst.mockResolvedValue({
      ...testUser,
      resetToken: tokenHash,
      resetTokenExpiresAt: new Date(Date.now() + 3600000),
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const res = await request(app).post("/api/auth/reset-password").send({
      token: rawToken,
      newPassword: "newpassword123",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("reset successfully");
  });

  it("rejects invalid/expired token", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/reset-password").send({
      token: "invalidtoken",
      newPassword: "newpassword123",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/me", () => {
  const app = createApp();

  it("returns current user profile", async () => {
    const token = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
    mockPrisma.user.findUnique.mockResolvedValue(testUser);

    const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@test.com");
    expect(res.body.user.organization).toHaveProperty("name", "Test Org");
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/users/me");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/users", () => {
  const app = createApp();

  it("admin can create manager", async () => {
    const token = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-2",
      email: "manager@test.com",
      name: "Manager",
      role: "MANAGER",
    });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "manager@test.com", password: "password123", name: "Manager", role: "MANAGER" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("MANAGER");
  });

  it("admin can create employee", async () => {
    const token = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-3",
      email: "emp@test.com",
      name: "Employee",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "emp@test.com", password: "password123", name: "Employee", role: "EMPLOYEE" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("EMPLOYEE");
  });

  it("manager can create employee", async () => {
    const token = makeJwt({ userId: "user-2", organizationId: "org-1", role: "MANAGER" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-4",
      email: "emp2@test.com",
      name: "Employee2",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "emp2@test.com", password: "password123", name: "Employee2", role: "EMPLOYEE" });

    expect(res.status).toBe(201);
  });

  it("manager cannot create manager", async () => {
    const token = makeJwt({ userId: "user-2", organizationId: "org-1", role: "MANAGER" });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "mgr2@test.com", password: "password123", name: "Manager2", role: "MANAGER" });

    expect(res.status).toBe(403);
  });

  it("employee cannot create users", async () => {
    const token = makeJwt({ userId: "user-3", organizationId: "org-1", role: "EMPLOYEE" });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@test.com", password: "password123", name: "New", role: "EMPLOYEE" });

    expect(res.status).toBe(403);
  });

  it("rejects duplicate email", async () => {
    const token = makeJwt({ userId: "user-1", organizationId: "org-1", role: "ADMIN" });
    mockPrisma.user.findUnique.mockResolvedValue(testUser);

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "admin@test.com", password: "password123", name: "Dup", role: "EMPLOYEE" });

    expect(res.status).toBe(409);
  });
});

describe("RBAC middleware", () => {
  const app = createApp();

  it("returns 401 for missing auth header", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is insufficient", async () => {
    const token = makeJwt({ userId: "user-3", organizationId: "org-1", role: "EMPLOYEE" });

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@test.com", password: "password123", name: "New", role: "EMPLOYEE" });

    expect(res.status).toBe(403);
  });
});
