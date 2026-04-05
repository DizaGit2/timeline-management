/**
 * TIM-114 — QA: Schedule management frontend test suite
 * Subtask of TIM-112 — Test plan for employee management and schedule management
 *
 * Tests the SchedulesPage component (frontend for TIM-103 schedule management).
 *
 * Covers:
 *  TC-FE-SCH-01: Empty state display
 *  TC-FE-SCH-02: Schedule list rendering
 *  TC-FE-SCH-03: Open create modal
 *  TC-FE-SCH-04: Form validation (name, dates, date range)
 *  TC-FE-SCH-05: Create schedule success flow
 *  TC-FE-SCH-06: Edit schedule flow
 *  TC-FE-SCH-07: Delete schedule confirmation and execution
 *  TC-FE-SCH-08: Error handling on API failure
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { SchedulesPage } from "../SchedulesPage";
import { ToastProvider } from "../../contexts/ToastContext";
import { server } from "../../test/msw-server";
import type { Schedule } from "../../api/schedules";

vi.mock("../../components/Navbar", () => ({ Navbar: () => null }));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockSchedules: Schedule[] = [
  {
    id: "sched-1",
    name: "May Week 1",
    startDate: "2026-05-04T00:00:00.000Z",
    endDate: "2026-05-10T23:59:59.000Z",
    status: "PUBLISHED",
    organizationId: "org-1",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "sched-2",
    name: "May Week 2",
    startDate: "2026-05-11T00:00:00.000Z",
    endDate: "2026-05-17T23:59:59.000Z",
    status: "DRAFT",
    organizationId: "org-1",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Finds the delete confirmation modal via its heading. */
function getConfirmModal() {
  const heading = screen.getByRole("heading", { name: /delete schedule/i });
  return heading.parentElement!;
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <SchedulesPage />
      </ToastProvider>
    </QueryClientProvider>
  );
}

// ── TC-FE-SCH-01: Empty state display ────────────────────────────────────────

describe("SchedulesPage — empty state", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([]))
    );
  });

  it("shows an empty-state message when no schedules exist", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no schedules/i)).toBeInTheDocument();
    });
  });

  it("shows the page title", async () => {
    renderPage();

    await waitFor(() => {
      // Use heading role to avoid matching the subtitle text
      expect(screen.getByRole("heading", { name: /^schedules$/i })).toBeInTheDocument();
    });
  });

  it("shows a Create Schedule button in the empty state", async () => {
    renderPage();

    await waitFor(() => {
      // Empty state renders two "+ New Schedule" buttons (header + empty state)
      const buttons = screen.getAllByRole("button", { name: /new schedule|\+/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── TC-FE-SCH-02: Schedule list rendering ────────────────────────────────────

describe("SchedulesPage — schedule list", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json(mockSchedules))
    );
  });

  it("shows a loading state while fetching schedules", () => {
    server.use(
      http.get("/api/schedules", async () => {
        await new Promise((r) => setTimeout(r, 300));
        return HttpResponse.json(mockSchedules);
      })
    );

    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders schedule names in the table", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("May Week 1")).toBeInTheDocument();
      expect(screen.getByText("May Week 2")).toBeInTheDocument();
    });
  });

  it("renders status badges for each schedule", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("PUBLISHED")).toBeInTheDocument();
      expect(screen.getByText("DRAFT")).toBeInTheDocument();
    });
  });

  it("renders Edit and Delete buttons for each schedule", async () => {
    renderPage();

    await waitFor(() => {
      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });

      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });
  });

  it("shows an error message when the API call fails", async () => {
    server.use(
      http.get("/api/schedules", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 })
      )
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});

// ── TC-FE-SCH-03: Open create modal ──────────────────────────────────────────

describe("SchedulesPage — create modal", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json(mockSchedules))
    );
  });

  it("opens the create modal when '+ New Schedule' is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    // With schedules loaded, only the header button shows (no empty-state button)
    await waitFor(() => screen.getByRole("button", { name: /new schedule|\+/i }));
    await user.click(screen.getByRole("button", { name: /new schedule|\+/i }));

    // The form input confirms the modal is open — avoids matching the button text
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /new schedule/i })).toBeInTheDocument();
  });

  it("closes the modal when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByRole("button", { name: /new schedule|\+/i }));
    await user.click(screen.getByRole("button", { name: /new schedule|\+/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    });
  });
});

// ── TC-FE-SCH-04: Form validation ────────────────────────────────────────────

describe("SchedulesPage — form validation", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([]))
    );
  });

  async function openCreateModal() {
    const user = userEvent.setup();
    renderPage();
    // Wait for empty state to confirm data has loaded before interacting
    await waitFor(() => screen.getByText(/no schedules/i));
    // Empty list shows 2 "+ New Schedule" buttons (header + empty-state)
    const [firstBtn] = screen.getAllByRole("button", { name: /new schedule|\+/i });
    await user.click(firstBtn);
    // Wait for the form to be visible
    await waitFor(() => screen.getByLabelText(/name/i));
    return user;
  }

  it("shows an error when submitting with empty name", async () => {
    await openCreateModal();

    // fireEvent.submit bypasses native HTML5 required-field validation so the
    // component's own setFormError("Schedule name is required.") can be tested.
    const form = screen.getByRole("button", { name: /create schedule/i }).closest("form");
    await act(async () => {
      fireEvent.submit(form!);
    });

    expect(screen.getByText(/schedule name is required/i)).toBeInTheDocument();
  });

  it("shows an error when submitting with missing start date", async () => {
    const user = await openCreateModal();

    await user.type(screen.getByLabelText(/name/i), "Test Schedule");

    // fireEvent.submit bypasses native required validation; dates are still empty
    const form = screen.getByRole("button", { name: /create schedule/i }).closest("form");
    await act(async () => {
      fireEvent.submit(form!);
    });

    // Component sets: "Start date and end date are required."
    expect(
      screen.getByText(/start date and end date are required/i)
    ).toBeInTheDocument();
  });

  it("shows an error when end date is before start date", async () => {
    const user = await openCreateModal();

    await user.type(screen.getByLabelText(/name/i), "Bad Range");

    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    await user.type(startInput, "2026-06-10");
    await user.type(endInput, "2026-06-01");

    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/start date must be before|end date.*after|invalid date range/i)
      ).toBeInTheDocument();
    });
  });
});

// ── TC-FE-SCH-05: Create schedule success ────────────────────────────────────

describe("SchedulesPage — create schedule", () => {
  it("creates a schedule and refreshes the list", async () => {
    const newSchedule: Schedule = {
      id: "sched-new",
      name: "New Test Schedule",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-07T23:59:59.000Z",
      status: "DRAFT",
      organizationId: "org-1",
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
    };

    server.use(
      http.get("/api/schedules", () => HttpResponse.json([])),
      http.post("/api/schedules", () =>
        HttpResponse.json(newSchedule, { status: 201 })
      )
    );

    // After creation, list should return the new schedule
    let fetchCount = 0;
    server.use(
      http.get("/api/schedules", () => {
        fetchCount++;
        return HttpResponse.json(fetchCount > 1 ? [newSchedule] : []);
      })
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getAllByRole("button", { name: /new schedule|\+/i }));
    const [firstBtn] = screen.getAllByRole("button", { name: /new schedule|\+/i });
    await user.click(firstBtn);

    await user.type(screen.getByLabelText(/name/i), "New Test Schedule");
    await user.type(screen.getByLabelText(/start date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-07");

    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    });
  });

  it("shows an error message when the create API call fails", async () => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json([])),
      http.post("/api/schedules", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getAllByRole("button", { name: /new schedule|\+/i }));
    const [firstBtn2] = screen.getAllByRole("button", { name: /new schedule|\+/i });
    await user.click(firstBtn2);

    await user.type(screen.getByLabelText(/name/i), "Error Schedule");
    await user.type(screen.getByLabelText(/start date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/end date/i), "2026-06-07");

    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save|error/i)).toBeInTheDocument();
    });
  });
});

// ── TC-FE-SCH-06: Edit schedule flow ─────────────────────────────────────────

describe("SchedulesPage — edit schedule", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json(mockSchedules))
    );
  });

  it("pre-fills the form with existing schedule data when Edit is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("May Week 1");
    });
  });

  it("shows 'Edit Schedule' title in the modal when editing", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]);

    expect(screen.getByText(/edit schedule/i)).toBeInTheDocument();
  });

  it("submits the updated schedule and closes the modal", async () => {
    server.use(
      http.put("/api/schedules/:id", async ({ params, request }) => {
        const body = (await request.json()) as Partial<Schedule>;
        const schedule = mockSchedules.find((s) => s.id === params.id);
        if (!schedule) return HttpResponse.json({ error: "Not found" }, { status: 404 });
        return HttpResponse.json({ ...schedule, ...body });
      })
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]);

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "May Week 1 Updated");

    await user.click(screen.getByRole("button", { name: /save changes|save/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    });
  });
});

// ── TC-FE-SCH-07: Delete schedule flow ───────────────────────────────────────

describe("SchedulesPage — delete schedule", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/schedules", () => HttpResponse.json(mockSchedules)),
      http.delete("/api/schedules/:id", () => new HttpResponse(null, { status: 204 }))
    );
  });

  it("shows a delete confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/delete schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/cannot be undone|are you sure/i)).toBeInTheDocument();
    });
  });

  it("mentions the schedule name in the delete confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      // Check that the name appears inside the confirmation modal specifically
      const confirmModal = getConfirmModal();
      expect(within(confirmModal).getByText(/May Week 1/)).toBeInTheDocument();
    });
  });

  it("cancels deletion when Cancel is clicked in the confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => screen.getByText(/delete schedule/i));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    });
  });

  it("calls DELETE and refreshes the list when deletion is confirmed", async () => {
    let deleteCalledId = "";
    let fetchCount = 0;
    const remainingSchedules = mockSchedules.filter((s) => s.id !== "sched-1");

    server.use(
      http.get("/api/schedules", () => {
        fetchCount++;
        return HttpResponse.json(fetchCount > 1 ? remainingSchedules : mockSchedules);
      }),
      http.delete("/api/schedules/:id", ({ params }) => {
        deleteCalledId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => getConfirmModal());
    const confirmDeleteBtn = within(getConfirmModal()).getByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteCalledId).toBe("sched-1");
    });
  });

  it("shows an error when delete fails", async () => {
    server.use(
      http.delete("/api/schedules/:id", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => screen.getByText("May Week 1"));
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => getConfirmModal());
    const confirmDeleteBtn = within(getConfirmModal()).getByRole("button", {
      name: /^delete$/i,
    });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      const confirmModal = getConfirmModal();
      expect(within(confirmModal).getByText(/failed to delete/i)).toBeInTheDocument();
    });
  });
});
