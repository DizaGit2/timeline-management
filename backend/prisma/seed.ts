import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@timeline.dev",
      passwordHash,
      name: "Dev Admin",
      role: "ADMIN",
      isActive: true,
      organization: {
        create: {
          name: "Dev Organization",
          ownerUserId: "", // placeholder
        },
      },
    },
    include: { organization: true },
  });

  await prisma.organization.update({
    where: { id: admin.organizationId },
    data: { ownerUserId: admin.id },
  });

  console.log(`Created admin user: ${admin.email} (password: admin123)`);
  console.log(`Created organization: ${admin.organization.name}`);

  // Create sample employees
  const emp1 = await prisma.employee.create({
    data: {
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@timeline.dev",
      position: "Cashier",
      organizationId: admin.organizationId,
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      firstName: "Bob",
      lastName: "Jones",
      email: "bob@timeline.dev",
      position: "Supervisor",
      organizationId: admin.organizationId,
    },
  });

  console.log(`Created employees: ${emp1.firstName}, ${emp2.firstName}`);

  // Create a sample schedule
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const schedule = await prisma.schedule.create({
    data: {
      name: "Week 1",
      startDate: weekStart,
      endDate: weekEnd,
      status: "DRAFT",
      organizationId: admin.organizationId,
    },
  });

  // Create sample shifts
  const shiftDate = new Date(weekStart);
  shiftDate.setDate(weekStart.getDate() + 1); // Monday

  const shift1Start = new Date(shiftDate);
  shift1Start.setHours(9, 0, 0, 0);
  const shift1End = new Date(shiftDate);
  shift1End.setHours(17, 0, 0, 0);

  const shift1 = await prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      employeeId: emp1.id,
      title: "Morning Shift",
      startTime: shift1Start,
      endTime: shift1End,
      role: "Cashier",
      requiredHeadcount: 2,
      notes: "Morning shift",
    },
  });

  const shift2Start = new Date(shiftDate);
  shift2Start.setHours(13, 0, 0, 0);
  const shift2End = new Date(shiftDate);
  shift2End.setHours(21, 0, 0, 0);

  const shift2 = await prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      employeeId: emp2.id,
      title: "Afternoon Shift",
      startTime: shift2Start,
      endTime: shift2End,
      role: "Supervisor",
      requiredHeadcount: 1,
      notes: "Afternoon shift",
    },
  });

  console.log(`Created schedule: ${schedule.name} with 2 shifts`);

  // Create sample shift assignments
  const assignment1 = await prisma.shiftAssignment.create({
    data: {
      shiftId: shift1.id,
      employeeId: emp1.id,
    },
  });

  const assignment2 = await prisma.shiftAssignment.create({
    data: {
      shiftId: shift2.id,
      employeeId: emp2.id,
    },
  });

  // Also assign emp2 to shift1 to demonstrate multi-assignment
  const assignment3 = await prisma.shiftAssignment.create({
    data: {
      shiftId: shift1.id,
      employeeId: emp2.id,
    },
  });

  console.log(
    `Created ${[assignment1, assignment2, assignment3].length} shift assignments`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
