/**
 * TIM-76 — Notifications (email + in-app) test suite
 *
 * Covers:
 *  - POST /api/shifts/:id/assign  → in-app + email notification on assignment
 *  - DELETE /api/shifts/:id/employees/:eid → in-app + email on removal
 *  - GET /api/notifications        → list unread notifications
 *  - PATCH /api/notifications/:id/read → mark single notification read
 *  - POST /api/notifications/read-all  → mark-all-as-read clears badge
 *
 * NOTE: Editing a shift (PATCH /api/shifts/:id) does NOT currently trigger
 *  notifyShiftUpdated — see todo test at the bottom. This is a known gap vs.
 *  TIM-37 acceptance criteria (tracked as a finding in TIM-76 comments).
 */

// Mock the email sender so SMTP is not required in test environments.
jest.mock("../lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import app from "../index";
import prisma from "../lib/prisma";
import { sendEmail } from "../lib/email";

const mockSendEmail = sendEmail as jest.Mock;

/** Flush all pending microtasks / promise chains. */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function createOrg(tag = Date.now()) {
  return prisma.organization.create({
    data: { name: `Notif Test Org ${tag}`, ownerUserId: "test-owner" },
  });
}

async function createManager(orgId: string, tag = Date.now()) {
  const bcrypt = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email: `notif-mgr-${tag}@test.com`,
      passwordHash: await bcrypt.hash("password", 1),
      name: "Notif Manager",
      role: "MANAGER",
      organizationId: orgId,
    },
  });
}

async function createEmployeeUser(orgId: string, tag = Date.now()) {
  const bcrypt = await import("bcryptjs");
  const email = `notif-emp-${tag}@test.com`;

  // User account (receives notifications)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("password", 1),
      name: "Notif Employee",
      role: "EMPLOYEE",
      organizationId: orgId,
    },
  });

  // Employee record with matching email (so notifications can link the two)
  const employee = await prisma.employee.create({
    data: {
      firstName: "Notif",
      lastName: "Employee",
      email,
      organizationId: orgId,
    },
  });

  return { user, employee };
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password" });
  return res.body.accessToken as string;
}

async function createSchedule(orgId: string) {
  return prisma.schedule.create({
    data: {
      name: "Notif Test Schedule",
      startDate: new Date("2026-05-05"),
      endDate: new Date("2026-05-11"),
      status: "PUBLISHED",
      organizationId: orgId,
    },
  });
}

async function createShift(scheduleId: string) {
  return prisma.shift.create({
    data: {
      scheduleId,
      title: "Evening Shift",
      startTime: new Date("2026-05-06T18:00:00Z"),
      endTime: new Date("2026-05-06T22:00:00Z"),
      location: "Main Floor",
    },
  });
}

// ---------------------------------------------------------------------------
// Email notification tests
// ---------------------------------------------------------------------------

describe("Email notifications via shift lifecycle events", () => {
  let orgId: string;
  let managerToken: string;
  let scheduleId: string;
  let employeeId: string;
  let userId: string;

  beforeAll(async () => {
    const tag = Date.now();
    const org = await createOrg(tag);
    orgId = org.id;

    const manager = await createManager(orgId, tag);
    managerToken = await loginAs(manager.email);

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;

    const { user, employee } = await createEmployeeUser(orgId, tag);
    userId = user.id;
    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    mockSendEmail.mockClear();
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.shiftAssignment.deleteMany({
      where: { shift: { scheduleId } },
    });
    await prisma.shift.deleteMany({ where: { scheduleId } });
  });

  it("sends an email when an employee is assigned to a shift", async () => {
    const shift = await createShift(scheduleId);

    const res = await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [employeeId] });

    expect(res.status).toBe(200);

    // Allow fire-and-forget chain to settle
    await flushPromises();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg, bodyArg] = mockSendEmail.mock.calls[0];
    expect(toArg).toMatch(/@test\.com$/);
    expect(subjectArg).toBe("Shift Assignment");
    expect(bodyArg).toContain("Evening Shift");
  });

  it("sends an email when an employee is removed from a shift", async () => {
    const shift = await createShift(scheduleId);

    // Assign first
    await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [employeeId] });

    mockSendEmail.mockClear();
    await prisma.notification.deleteMany({ where: { userId } });

    // Remove
    const res = await request(app)
      .delete(`/api/shifts/${shift.id}/employees/${employeeId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(204);

    await flushPromises();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [toArg, subjectArg, bodyArg] = mockSendEmail.mock.calls[0];
    expect(toArg).toMatch(/@test\.com$/);
    expect(subjectArg).toBe("Shift Unassigned");
    expect(bodyArg).toContain("Evening Shift");
  });

  it("does not send an email for an employee with no linked User account", async () => {
    // Create an employee with no matching User record
    const orphanEmployee = await prisma.employee.create({
      data: {
        firstName: "No",
        lastName: "Account",
        email: `orphan-${Date.now()}@nowhere.com`,
        organizationId: orgId,
      },
    });

    const shift = await createShift(scheduleId);

    await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [orphanEmployee.id] });

    await flushPromises();

    expect(mockSendEmail).not.toHaveBeenCalled();

    await prisma.employee.delete({ where: { id: orphanEmployee.id } });
  });

  it.todo(
    "sends an update email when an assigned shift's time is changed — " +
      "PATCH /api/shifts/:id does not yet call notifyShiftUpdated (gap vs TIM-37)"
  );
});

// ---------------------------------------------------------------------------
// In-app notification API tests
// ---------------------------------------------------------------------------

describe("GET /api/notifications — list notifications", () => {
  let orgId: string;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const tag = Date.now();
    const org = await createOrg(tag);
    orgId = org.id;
    const { user } = await createEmployeeUser(orgId, tag);
    userId = user.id;
    token = await loginAs(`notif-emp-${tag}@test.com`);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { userId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("returns an empty array when there are no notifications", async () => {
    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns unread notifications with isRead=false", async () => {
    await prisma.notification.createMany({
      data: [
        {
          userId,
          type: "SHIFT_ASSIGNED",
          title: "Shift A",
          body: "You were assigned.",
          isRead: false,
        },
        {
          userId,
          type: "SHIFT_UPDATED",
          title: "Shift B",
          body: "Shift was updated.",
          isRead: false,
        },
      ],
    });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((n: { isRead: boolean }) => n.isRead === false)).toBe(true);
  });

  it("returns both read and unread notifications together", async () => {
    await prisma.notification.createMany({
      data: [
        {
          userId,
          type: "SHIFT_ASSIGNED",
          title: "Read Notif",
          body: "Already read.",
          isRead: true,
        },
        {
          userId,
          type: "SHIFT_REMOVED",
          title: "Unread Notif",
          body: "Not yet read.",
          isRead: false,
        },
      ],
    });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const unreadCount = res.body.filter((n: { isRead: boolean }) => !n.isRead).length;
    expect(unreadCount).toBe(1);
  });

  it("returns notifications ordered by createdAt descending (newest first)", async () => {
    const n1 = await prisma.notification.create({
      data: { userId, type: "SHIFT_ASSIGNED", title: "Older", body: "old", isRead: false },
    });
    // Small delay to guarantee distinct createdAt timestamps
    await new Promise((r) => setTimeout(r, 5));
    const n2 = await prisma.notification.create({
      data: { userId, type: "SHIFT_UPDATED", title: "Newer", body: "new", isRead: false },
    });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(n2.id);
    expect(res.body[1].id).toBe(n1.id);
  });

  it("does not return another user's notifications", async () => {
    const tag2 = Date.now() + 1;
    const org2 = await createOrg(tag2);
    const { user: otherUser } = await createEmployeeUser(org2.id, tag2);

    await prisma.notification.create({
      data: {
        userId: otherUser.id,
        type: "SHIFT_ASSIGNED",
        title: "Other User Notif",
        body: "Not yours.",
        isRead: false,
      },
    });

    const res = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((n: { userId: string }) => n.userId === userId)).toBe(true);

    await prisma.organization.delete({ where: { id: org2.id } });
  });
});

describe("PATCH /api/notifications/:id/read — mark single notification as read", () => {
  let orgId: string;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const tag = Date.now();
    const org = await createOrg(tag);
    orgId = org.id;
    const { user } = await createEmployeeUser(orgId, tag);
    userId = user.id;
    token = await loginAs(`notif-emp-${tag}@test.com`);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { userId } });
  });

  it("marks an unread notification as read", async () => {
    const notif = await prisma.notification.create({
      data: {
        userId,
        type: "SHIFT_ASSIGNED",
        title: "Mark Me",
        body: "Please read.",
        isRead: false,
      },
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
    expect(res.body.id).toBe(notif.id);
  });

  it("is idempotent — marking an already-read notification succeeds", async () => {
    const notif = await prisma.notification.create({
      data: {
        userId,
        type: "SHIFT_UPDATED",
        title: "Already Read",
        body: "Read this.",
        isRead: true,
      },
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
  });

  it("returns 404 for a non-existent notification id", async () => {
    const res = await request(app)
      .patch("/api/notifications/nonexistent-id/read")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 when trying to mark another user's notification as read", async () => {
    const tag2 = Date.now() + 2;
    const org2 = await createOrg(tag2);
    const { user: otherUser } = await createEmployeeUser(org2.id, tag2);

    const otherNotif = await prisma.notification.create({
      data: {
        userId: otherUser.id,
        type: "SHIFT_ASSIGNED",
        title: "Not Yours",
        body: "Belongs to another.",
        isRead: false,
      },
    });

    const res = await request(app)
      .patch(`/api/notifications/${otherNotif.id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);

    await prisma.organization.delete({ where: { id: org2.id } });
  });

  it("returns 401 when not authenticated", async () => {
    const notif = await prisma.notification.create({
      data: {
        userId,
        type: "SHIFT_REMOVED",
        title: "Auth Check",
        body: "Need auth.",
        isRead: false,
      },
    });

    const res = await request(app).patch(`/api/notifications/${notif.id}/read`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/notifications/read-all — mark all notifications as read", () => {
  let orgId: string;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const tag = Date.now();
    const org = await createOrg(tag);
    orgId = org.id;
    const { user } = await createEmployeeUser(orgId, tag);
    userId = user.id;
    token = await loginAs(`notif-emp-${tag}@test.com`);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { userId } });
  });

  it("marks all unread notifications as read and clears the unread count", async () => {
    await prisma.notification.createMany({
      data: [
        { userId, type: "SHIFT_ASSIGNED", title: "N1", body: "b1", isRead: false },
        { userId, type: "SHIFT_UPDATED", title: "N2", body: "b2", isRead: false },
        { userId, type: "SHIFT_REMOVED", title: "N3", body: "b3", isRead: false },
      ],
    });

    const res = await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    // Verify all notifications are now read
    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    const unread = listRes.body.filter((n: { isRead: boolean }) => !n.isRead);
    expect(unread).toHaveLength(0);
    expect(listRes.body).toHaveLength(3);
  });

  it("is a no-op when there are no unread notifications", async () => {
    await prisma.notification.create({
      data: { userId, type: "SHIFT_ASSIGNED", title: "Already Read", body: "x", isRead: true },
    });

    const res = await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it("does not affect another user's notifications", async () => {
    const tag2 = Date.now() + 3;
    const org2 = await createOrg(tag2);
    const { user: otherUser } = await createEmployeeUser(org2.id, tag2);

    const otherNotif = await prisma.notification.create({
      data: {
        userId: otherUser.id,
        type: "SHIFT_ASSIGNED",
        title: "Other Unread",
        body: "not touched",
        isRead: false,
      },
    });

    await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    const still = await prisma.notification.findUnique({ where: { id: otherNotif.id } });
    expect(still?.isRead).toBe(false);

    await prisma.organization.delete({ where: { id: org2.id } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).post("/api/notifications/read-all");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: assignment triggers in-app notification persisted to DB
// ---------------------------------------------------------------------------

describe("End-to-end: shift assignment creates in-app notification", () => {
  let orgId: string;
  let userId: string;
  let employeeId: string;
  let managerToken: string;
  let employeeToken: string;
  let scheduleId: string;

  beforeAll(async () => {
    const tag = Date.now();
    const org = await createOrg(tag);
    orgId = org.id;

    const manager = await createManager(orgId, tag);
    managerToken = await loginAs(manager.email);

    const { user, employee } = await createEmployeeUser(orgId, tag);
    userId = user.id;
    employeeId = employee.id;
    employeeToken = await loginAs(`notif-emp-${tag}@test.com`);

    const schedule = await createSchedule(orgId);
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    mockSendEmail.mockClear();
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.shiftAssignment.deleteMany({
      where: { shift: { scheduleId } },
    });
    await prisma.shift.deleteMany({ where: { scheduleId } });
  });

  it("notification bell: employee sees a SHIFT_ASSIGNED notification after being assigned", async () => {
    const shift = await createShift(scheduleId);

    await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [employeeId] });

    await flushPromises();

    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);

    const assignedNotif = listRes.body.find(
      (n: { type: string }) => n.type === "SHIFT_ASSIGNED"
    );
    expect(assignedNotif).toBeDefined();
    expect(assignedNotif.isRead).toBe(false);
    expect(assignedNotif.title).toBe("Shift Assignment");
    expect(assignedNotif.body).toContain("Evening Shift");
  });

  it("notification bell: employee sees a SHIFT_REMOVED notification after being unassigned", async () => {
    const shift = await createShift(scheduleId);

    // Assign
    await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [employeeId] });

    await flushPromises();
    await prisma.notification.deleteMany({ where: { userId } });

    // Remove
    await request(app)
      .delete(`/api/shifts/${shift.id}/employees/${employeeId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    await flushPromises();

    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(listRes.status).toBe(200);
    const removedNotif = listRes.body.find(
      (n: { type: string }) => n.type === "SHIFT_REMOVED"
    );
    expect(removedNotif).toBeDefined();
    expect(removedNotif.isRead).toBe(false);
    expect(removedNotif.title).toBe("Shift Unassigned");
  });

  it("clicking a notification (mark-as-read) removes it from the unread count", async () => {
    const shift = await createShift(scheduleId);

    await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [employeeId] });

    await flushPromises();

    // Get the notification
    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);

    const notif = listRes.body.find((n: { type: string }) => n.type === "SHIFT_ASSIGNED");
    expect(notif).toBeDefined();
    expect(notif.isRead).toBe(false);

    // Mark as read (simulating clicking the bell item)
    const readRes = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.isRead).toBe(true);

    // Confirm no more unread
    const afterRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);

    const unread = afterRes.body.filter((n: { isRead: boolean }) => !n.isRead);
    expect(unread).toHaveLength(0);
  });

  it("mark-all-as-read clears the notification badge (all unread → zero)", async () => {
    const shift = await createShift(scheduleId);

    await request(app)
      .post(`/api/shifts/${shift.id}/assign`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ employeeIds: [employeeId] });

    await flushPromises();

    // Verify there's at least one unread
    const beforeRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(beforeRes.body.some((n: { isRead: boolean }) => !n.isRead)).toBe(true);

    // Mark all as read
    const markAllRes = await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(markAllRes.status).toBe(200);

    // Badge should now be empty
    const afterRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${employeeToken}`);

    const unread = afterRes.body.filter((n: { isRead: boolean }) => !n.isRead);
    expect(unread).toHaveLength(0);
  });
});
