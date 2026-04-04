import { PrismaClient, UserRole, ScheduleStatus, Recurrence } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.availability.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: "Acme Corp",
      slug: "acme-corp",
    },
  });

  // Create users
  const adminUser = await prisma.user.create({
    data: {
      orgId: org.id,
      email: "admin@acme.com",
      passwordHash: "$2b$10$placeholder_admin_hash",
      role: UserRole.admin,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      orgId: org.id,
      email: "manager@acme.com",
      passwordHash: "$2b$10$placeholder_manager_hash",
      role: UserRole.manager,
    },
  });

  const employeeUser1 = await prisma.user.create({
    data: {
      orgId: org.id,
      email: "alice@acme.com",
      passwordHash: "$2b$10$placeholder_emp1_hash",
      role: UserRole.employee,
    },
  });

  const employeeUser2 = await prisma.user.create({
    data: {
      orgId: org.id,
      email: "bob@acme.com",
      passwordHash: "$2b$10$placeholder_emp2_hash",
      role: UserRole.employee,
    },
  });

  // Create employees linked to users
  const empAdmin = await prisma.employee.create({
    data: {
      orgId: org.id,
      userId: adminUser.id,
      firstName: "Chris",
      lastName: "Admin",
      email: "admin@acme.com",
      position: "Operations Director",
      hiredAt: new Date("2023-01-15"),
    },
  });

  const empManager = await prisma.employee.create({
    data: {
      orgId: org.id,
      userId: managerUser.id,
      firstName: "Dana",
      lastName: "Manager",
      email: "manager@acme.com",
      position: "Shift Supervisor",
      hiredAt: new Date("2023-03-01"),
    },
  });

  const empAlice = await prisma.employee.create({
    data: {
      orgId: org.id,
      userId: employeeUser1.id,
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@acme.com",
      phone: "+1-555-0101",
      position: "Barista",
      hiredAt: new Date("2024-06-01"),
    },
  });

  const empBob = await prisma.employee.create({
    data: {
      orgId: org.id,
      userId: employeeUser2.id,
      firstName: "Bob",
      lastName: "Jones",
      email: "bob@acme.com",
      phone: "+1-555-0102",
      position: "Barista",
      hiredAt: new Date("2024-07-15"),
    },
  });

  // Employee without a user account (e.g. not yet onboarded)
  const empCharlie = await prisma.employee.create({
    data: {
      orgId: org.id,
      firstName: "Charlie",
      lastName: "Brown",
      email: "charlie@acme.com",
      position: "Cashier",
    },
  });

  // Create a schedule for next week
  const nextMonday = getNextMonday();
  const schedule = await prisma.schedule.create({
    data: {
      orgId: org.id,
      name: `Week of ${nextMonday.toISOString().slice(0, 10)}`,
      weekStart: nextMonday,
      status: ScheduleStatus.draft,
    },
  });

  // Create shifts
  const shiftData = [
    { employee: empAlice, dayOffset: 0, startHour: 7, endHour: 15, role: "Opening Barista" },
    { employee: empBob, dayOffset: 0, startHour: 12, endHour: 20, role: "Closing Barista" },
    { employee: empAlice, dayOffset: 1, startHour: 7, endHour: 15, role: "Opening Barista" },
    { employee: empCharlie, dayOffset: 1, startHour: 10, endHour: 18, role: "Cashier" },
    { employee: empBob, dayOffset: 2, startHour: 7, endHour: 15, role: "Opening Barista" },
    { employee: empAlice, dayOffset: 2, startHour: 12, endHour: 20, role: "Closing Barista" },
  ];

  for (const s of shiftData) {
    const start = new Date(nextMonday);
    start.setDate(start.getDate() + s.dayOffset);
    start.setHours(s.startHour, 0, 0, 0);

    const end = new Date(start);
    end.setHours(s.endHour, 0, 0, 0);

    await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        employeeId: s.employee.id,
        startTime: start,
        endTime: end,
        role: s.role,
      },
    });
  }

  // Create availability records
  const availabilityData = [
    // Alice: available Mon–Fri mornings
    ...[1, 2, 3, 4, 5].map((day) => ({
      employeeId: empAlice.id,
      dayOfWeek: day,
      startTime: "06:00",
      endTime: "16:00",
      recurrence: Recurrence.weekly,
    })),
    // Bob: available Mon–Sat afternoons
    ...[1, 2, 3, 4, 5, 6].map((day) => ({
      employeeId: empBob.id,
      dayOfWeek: day,
      startTime: "10:00",
      endTime: "22:00",
      recurrence: Recurrence.weekly,
    })),
    // Charlie: available Wed–Sun
    ...[0, 3, 4, 5, 6].map((day) => ({
      employeeId: empCharlie.id,
      dayOfWeek: day,
      startTime: "08:00",
      endTime: "18:00",
      recurrence: Recurrence.weekly,
    })),
  ];

  for (const a of availabilityData) {
    await prisma.availability.create({ data: a });
  }

  console.log("Seed complete:");
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Users: 4`);
  console.log(`  Employees: 5 (1 without user account)`);
  console.log(`  Schedules: 1`);
  console.log(`  Shifts: ${shiftData.length}`);
  console.log(`  Availability records: ${availabilityData.length}`);
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
