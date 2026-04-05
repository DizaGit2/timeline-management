# Timeline Management — User Wiki

Welcome to the Timeline Management platform. This wiki covers everything you need to know to use the system effectively.

***

## Table of Contents

1. [Getting Started (Post-Login Walkthrough)](#getting-started)
2. [Managing Employees](#managing-employees)
3. [Creating and Managing Schedules](#managing-schedules)
4. [Creating and Assigning Shifts](#managing-shifts)
5. [Availability and Notifications](#availability-and-notifications)
6. [FAQ / Common Workflows](#faq)

***

## 1. Getting Started (Post-Login Walkthrough)

### Creating Your Account

If your organization is new to Timeline Management:

1. Navigate to `/register`.
2. Enter your **first and last name**, **email address**, **password**, and your **organization name**.
3. Click **Register**. You are automatically logged in as an Admin.

> **Already have an account?** Go to `/login`, enter your email and password, and click **Sign In**.

### Forgot Your Password?

1. On the login page, click **Forgot password?**.
2. Enter your email and click **Send reset link**.
3. Check your inbox and follow the link to set a new password.

### The Dashboard

After logging in you land on the **Dashboard**. It shows:

* Your name, email, and role badge (**Admin**, **Manager**, or **Employee**).
* Quick links relevant to your role (e.g., **Shifts** for Managers and Admins).
* A **Sign Out** button in the top-right.

### Role Overview

| Role         | What they can do                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **Admin**    | Full access: manage employees, schedules, shifts, reports, and reactivate deactivated employees. |
| **Manager**  | Create/edit employees, schedules, and shifts; view reports. Cannot reactivate employees.         |
| **Employee** | View their own schedule, manage their own availability, and receive notifications.               |

***

## 2. Managing Employees

> **Who can do this:** Admin and Manager roles only.

### Viewing the Employee List

1. Click **Employees** in the navigation.
2. Use the **search bar** to filter by name or email.
3. Use the **status filter** (Active / Inactive / All) to show the relevant employees.

### Adding a New Employee

1. On the Employees page, click **Add Employee**.
2. Fill in the form:
   * **First Name** and **Last Name** — required.
   * **Email** — optional but recommended for notifications.
   * **Phone** — optional.
   * **Position** — optional (e.g., "Barista", "Shift Lead").
   * **Hourly Rate** — optional numeric value.
3. Click **Save**. The employee now appears in the active list.

### Editing an Employee

1. Locate the employee in the list.
2. Click the **Edit** (pencil) icon next to their name.
3. Update any fields and click **Save**.

### Deactivating an Employee

Deactivation is a soft delete — the employee record is preserved but they no longer appear in active lists or scheduling.

1. Find the employee in the active list.
2. Click **Deactivate** (or the trash icon).
3. Confirm the action.

### Reactivating an Employee (Admin only)

1. Set the status filter to **Inactive**.
2. Find the employee and click **Reactivate**.

***

## 3. Creating and Managing Schedules

> **Who can do this:** Admin and Manager roles only.

A **Schedule** is a named container with a date range that holds one or more shifts. Typical usage: create one schedule per week or pay period.

### Creating a Schedule

1. Navigate to **Schedules**.
2. Click **New Schedule**.
3. Provide:
   * **Name** — e.g., "Week of Apr 7".
   * **Start Date** and **End Date**.
4. Click **Create**. The schedule starts as a **Draft**.

### Schedule Statuses

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| **Draft**     | Being built; not visible to employees yet.                         |
| **Published** | Live; employees can see assigned shifts and receive notifications. |
| **Archived**  | Closed period; retained for record-keeping.                        |

To change a status, open the schedule, click **Edit**, update the **Status** field, and save.

### Editing or Deleting a Schedule

* **Edit:** Click the schedule name → click **Edit** → update fields → **Save**.
* **Delete:** Click **Delete** on the schedule. This removes the schedule and its shifts permanently.

### Copying a Week of Shifts

Instead of rebuilding a schedule from scratch, copy an existing week:

1. Open the target schedule on the **Schedule** (calendar) page.
2. Click **Copy Week**.
3. Select the **source week** to copy from.
4. Click **Confirm**. Shifts are duplicated with adjusted dates. Existing shifts in the target week are **not** overwritten.

***

## 4. Creating and Assigning Shifts

> **Who can do this:** Admin and Manager roles only.

### Creating a Shift

1. Navigate to **Shifts** or open a schedule in the calendar view.
2. Click **New Shift** (or click an empty slot in the calendar).
3. Fill in the form:
   * **Schedule** — select which schedule this shift belongs to (required).
   * **Title** — e.g., "Morning Barista" (required).
   * **Start Time** and **End Time** — required.
   * **Location** — optional.
   * **Role** — optional (e.g., "Cashier").
   * **Required Headcount** — how many employees are needed (defaults to 1).
   * **Notes** — any additional instructions.
4. Click **Create Shift**.

### Assigning Employees to a Shift

1. Open the shift (click it in the calendar or list view).
2. Click **Assign Employee**.
3. Search for an employee by name.
4. If a **conflict** is detected, you will see a warning:
   * **Double-booking** — the employee already has an overlapping shift.
   * **Unavailability** — the employee has marked themselves unavailable on that day.
5. Review the warning and choose to proceed or pick a different employee.
6. Click **Confirm Assignment**.

> An employee can be assigned to multiple shifts, and multiple employees can share one shift.

### Removing an Employee from a Shift

1. Open the shift.
2. In the **Assigned Employees** list, click the **X** next to the employee.
3. The employee is removed and notified automatically.

### Editing or Deleting a Shift

* **Edit:** Open the shift → click **Edit** → update fields → **Save**. Assigned employees are notified of changes.
* **Delete:** Open the shift → click **Delete**. This permanently removes the shift.

### Filtering Shifts

On the Shifts page you can filter by:

* **Schedule** — show shifts from a specific schedule.
* **Date Range** — show shifts between two dates.
* **Employee** — show shifts assigned to a specific person.

***

## 5. Availability and Notifications

### Setting Your Recurring Availability

> **Who can do this:** Every user can manage their own availability. Managers and Admins can view all employees' availability.

1. Navigate to **Availability**.
2. For each day of the week, click **Add Window**.
3. Set the **Start Time**, **End Time**, and **Type**:
   * **Available** — you can work this window.
   * **Unavailable** — you cannot work this window.
   * **Preferred** — you prefer to work this window.
4. Click **Save**. These recurring windows apply every week.

> **Tip:** You can add multiple windows per day (e.g., 9 am–12 pm and 2 pm–6 pm).

### Adding a Time-Off Exception

For one-off dates when you are unavailable (vacation, appointment, etc.):

1. On the Availability page, scroll to **Time-Off Exceptions**.
2. Click **Add Exception**.
3. Select the **Date** and enter an optional **Reason** (e.g., "Doctor appointment").
4. Click **Save**. Managers will see this flag when assigning you to shifts on that date.

### Removing a Time-Off Exception

1. In the **Time-Off Exceptions** list, click the **X** next to the entry you want to remove.

### Manager: Viewing Team Availability

1. Navigate to **Availability**.
2. The weekly summary shows all active employees and their availability windows organized by day.
3. Use this view when planning shifts to avoid scheduling conflicts.

### Notifications

You receive an in-app notification when:

* You are **assigned** to a shift.
* A shift you are assigned to is **updated** (time, location, role, etc.).
* You are **removed** from a shift.
* A schedule you are part of is **published**.

**To view notifications:**

1. Click the **bell icon** in the top navigation bar.
2. A dropdown lists your recent notifications.
3. Click a notification to view details.

**To mark notifications as read:**

* Click a single notification to mark it read, **or**
* Click **Mark all as read** at the top of the dropdown.

***

## 6. FAQ / Common Workflows

### How do I build a schedule for next week from scratch?

1. Go to **Schedules** → **New Schedule** → enter a name and the week's start/end dates → **Create**.
2. Go to **Shifts** → **New Shift** → link each shift to the new schedule, set times and headcount.
3. Assign employees to each shift, watching for conflict warnings.
4. When ready, open the schedule → **Edit** → set status to **Published** → **Save**. Employees are notified.

### How do I reuse last week's schedule?

1. Open this week's schedule in the calendar view.
2. Click **Copy Week** and select last week as the source.
3. Review the copied shifts, adjust any times or assignments as needed.
4. Publish when ready.

### An employee called out sick — how do I remove them and find a replacement?

1. Open the affected shift.
2. Click **X** next to the absent employee to remove them. They are notified.
3. Click **Assign Employee** and search for an available replacement.
4. Check the conflict warnings — if the system flags an unavailability, consider a different employee.
5. Confirm the assignment. The replacement is notified.

### How can I see which shifts are understaffed?

1. Navigate to **Reports** (Manager/Admin only).
2. Open the **Unfilled Shifts** report to see all shifts where headcount is not yet met.

### How do I export a schedule for payroll?

1. Go to **Reports** → **Schedule CSV Export**.
2. Select the date range or schedule.
3. Download the CSV file for use in Excel or your payroll tool.

### An employee says they never received a shift notification — what should I check?

* Confirm the employee's **email address** is on file (Employees → Edit).
* Ask them to check their in-app notification bell — in-app notifications are always delivered.
* Ensure the schedule status was set to **Published** (employees are only notified on publish and on assignment).

### How do I change an employee's role?

Role management is handled through the admin area. Contact your system administrator if you need a user's role changed.

### Can an employee see the full team schedule?

No. Employees can only see their **own** shifts via the **My Schedule** page. Only Managers and Admins can view the full schedule and team availability.

***

*Last updated: April 2026. For issues or feedback, contact your system administrator.*
