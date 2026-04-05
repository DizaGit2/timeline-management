import type { Shift } from "../api/shifts";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  position?: string | null;
  role?: string;
}

export const mockEmployees: Employee[] = [
  {
    id: "emp-1",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    position: "Barista",
    role: "EMPLOYEE",
  },
  {
    id: "emp-2",
    firstName: "Bob",
    lastName: "Jones",
    email: "bob@example.com",
    position: "Supervisor",
    role: "MANAGER",
  },
  {
    id: "emp-3",
    firstName: "Carol",
    lastName: "White",
    email: "carol@example.com",
    position: "Cashier",
    role: "EMPLOYEE",
  },
];

/** Week starting 2026-04-06 (Monday) — col 0 = Mon Apr 6, col 1 = Tue Apr 7, col 3 = Thu Apr 9 */
export const WEEK_START = new Date("2026-04-06T00:00:00.000Z");
export const WEEK_END = new Date("2026-04-12T23:59:59.999Z");

export const mockShifts: Shift[] = [
  {
    id: "shift-1",
    scheduleId: "sched-1",
    schedule: { id: "sched-1", name: "Week of April 6" },
    title: "Morning Shift",
    startTime: "2026-04-07T08:00:00.000Z", // Tuesday
    endTime: "2026-04-07T16:00:00.000Z",
    employeeId: "emp-1",
    employee: { id: "emp-1", firstName: "Alice", lastName: "Smith", position: "Barista" },
    role: "Barista",
    location: "Front Counter",
    requiredHeadcount: 1,
    assignments: [],
    notes: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
  },
  {
    id: "shift-2",
    scheduleId: "sched-1",
    schedule: { id: "sched-1", name: "Week of April 6" },
    title: "Evening Shift",
    startTime: "2026-04-07T16:00:00.000Z", // Tuesday
    endTime: "2026-04-08T00:00:00.000Z",
    employeeId: "emp-2",
    employee: { id: "emp-2", firstName: "Bob", lastName: "Jones", position: "Supervisor" },
    role: "Supervisor",
    location: "Back Office",
    requiredHeadcount: 1,
    assignments: [],
    notes: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
  },
  {
    id: "shift-3",
    scheduleId: "sched-1",
    schedule: { id: "sched-1", name: "Week of April 6" },
    title: "Morning Shift",
    startTime: "2026-04-09T08:00:00.000Z", // Thursday
    endTime: "2026-04-09T16:00:00.000Z",
    employeeId: "emp-3",
    employee: { id: "emp-3", firstName: "Carol", lastName: "White", position: "Cashier" },
    role: "Cashier",
    location: "Front Counter",
    requiredHeadcount: 1,
    assignments: [],
    notes: null,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
  },
];

export const mockSchedule = {
  id: "sched-1",
  name: "Week of April 6",
  startDate: "2026-04-06T00:00:00.000Z",
  endDate: "2026-04-12T23:59:59.999Z",
  status: "PUBLISHED" as const,
  organizationId: "org-1",
  shifts: mockShifts,
};
