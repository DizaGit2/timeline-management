/**
 * TIM-183 — Toast notification system tests
 *
 * Covers:
 *  TC-TOAST-01: Toast appears with success message
 *  TC-TOAST-02: Toast appears with error message
 *  TC-TOAST-03: Toast can be manually dismissed
 *  TC-TOAST-04: SchedulesPage shows success toast after create
 *  TC-TOAST-05: SchedulesPage shows error toast on create failure
 *  TC-TOAST-06: SchedulesPage shows success toast after delete
 *  TC-TOAST-07: ShiftsPage shows success toast after delete
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { ToastProvider } from "../ToastContext";
import { SchedulesPage } from "../../pages/SchedulesPage";
import { ShiftsPage } from "../../pages/ShiftsPage";
import { server } from "../../test/msw-server";
import type { Schedule } from "../../api/schedules";

vi.mock("../../components/Navbar", () => ({ Navbar: () => null }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockSchedule: Schedule = {
  id: "sched-1",
  name: "May Week 1",
  startDate: "2026-05-04T00:00:00.000Z",
  endDate: "2026-05-10T23:59:59.000Z",
  status: "PUBLISHED",
  organizationId: "org-1",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQc() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderSchedulesPage() {
  return render(
    <QueryClientProvider client={makeQc()}>
      <ToastProvider>
        <SchedulesPage />
      </ToastProvider>
    </QueryClientProvider>
  );
}

function renderShiftsPage() {
  return render(
    <QueryClientProvider client={makeQc()}>
      <ToastProvider>
        <ShiftsPage />
      </ToastProvider>
    </QueryClientProvider>
  );
}

// ── TC-TOAST-01 & 02: ToastProvider renders and dismisses toasts ──────────────

describe("ToastProvider", () => {
  it("renders children without crashing", () => {
    render(
      <ToastProvider>
        <div>content</div>
      </ToastProvider>
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

// ── TC-TOAST-03: Manual dismiss ───────────────────────────────────────────────

describe("Toast — manual dismiss", () => {
  it("dismisses toast when × button is clicked", async () => {
    // We trigger a toast by performing a successful create action
    const user = userEvent.setup();
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([])),
      http.post("/api/schedules", () =>
        HttpResponse.json({ ...mockSchedule, id: "new-1" }, { status: 201 })
      )
    );

    renderSchedulesPage();
    await waitFor(() => screen.getAllByRole("button", { name: /new schedule|\+/i }));
    const [btn] = screen.getAllByRole("button", { name: /new schedule|\+/i });
    await user.click(btn);
    await waitFor(() => screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), "Test");
    await user.type(screen.getByLabelText(/start date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-07");
    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    const toast = await screen.findByRole("alert");
    expect(toast).toBeInTheDocument();

    const dismissBtn = within(toast).getByRole("button", { name: /dismiss/i });
    await user.click(dismissBtn);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

// ── TC-TOAST-04: Schedule create success toast ────────────────────────────────

describe("SchedulesPage — create success toast", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([])),
      http.post("/api/schedules", () =>
        HttpResponse.json({ ...mockSchedule, id: "new-1" }, { status: 201 })
      )
    );
  });

  it("shows a success toast after creating a schedule", async () => {
    const user = userEvent.setup();
    renderSchedulesPage();

    await waitFor(() => screen.getAllByRole("button", { name: /new schedule|\+/i }));
    const [btn] = screen.getAllByRole("button", { name: /new schedule|\+/i });
    await user.click(btn);

    await waitFor(() => screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), "May Week 1");
    await user.type(screen.getByLabelText(/start date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-07");
    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/created successfully/i);
    });
  });
});

// ── TC-TOAST-05: Schedule create error toast ──────────────────────────────────

describe("SchedulesPage — create error toast", () => {
  it("shows an error toast when schedule creation fails", async () => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([])),
      http.post("/api/schedules", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderSchedulesPage();

    await waitFor(() => screen.getAllByRole("button", { name: /new schedule|\+/i }));
    const [btn] = screen.getAllByRole("button", { name: /new schedule|\+/i });
    await user.click(btn);

    await waitFor(() => screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), "Error Schedule");
    await user.type(screen.getByLabelText(/start date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-07");
    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/failed to create/i);
    });
  });
});

// ── TC-TOAST-06: Schedule delete success toast ────────────────────────────────

describe("SchedulesPage — delete success toast", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([mockSchedule])),
      http.delete("/api/schedules/:id", () => new HttpResponse(null, { status: 204 }))
    );
  });

  it("shows a success toast after deleting a schedule", async () => {
    const user = userEvent.setup();
    renderSchedulesPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const [deleteBtn] = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteBtn);

    const confirmModal = screen
      .getByRole("heading", { name: /delete schedule/i })
      .parentElement!;
    const confirmDeleteBtn = within(confirmModal).getByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/deleted/i);
    });
  });
});

// ── TC-TOAST-07: Shift delete success toast ───────────────────────────────────

describe("ShiftsPage — delete success toast", () => {
  it("shows a success toast after deleting a shift", async () => {
    const mockShift = {
      id: "shift-1",
      title: "Morning Shift",
      scheduleId: "sched-1",
      startTime: "2026-06-01T08:00:00.000Z",
      endTime: "2026-06-01T16:00:00.000Z",
      location: null,
      role: null,
      requiredHeadcount: 1,
      notes: null,
      schedule: { id: "sched-1", name: "May Week 1" },
      assignments: [],
    };

    server.use(
      http.get("/api/shifts", () => HttpResponse.json([mockShift])),
      http.get("/api/employees", () => HttpResponse.json([])),
      http.get("/api/schedules", () => HttpResponse.json([])),
      http.delete("/api/shifts/:id", () => new HttpResponse(null, { status: 204 }))
    );

    const user = userEvent.setup();
    renderShiftsPage();

    await waitFor(() => screen.getByText("Morning Shift"));
    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteBtn);

    const confirmModal = screen
      .getByRole("heading", { name: /delete shift/i })
      .parentElement!;
    const confirmDeleteBtn = within(confirmModal).getByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/deleted/i);
    });
  });
});
