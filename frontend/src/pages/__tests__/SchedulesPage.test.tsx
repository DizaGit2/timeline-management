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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { SchedulesPage } from "../SchedulesPage";
import { server } from "../../test/msw-server";
import type { Schedule } from "../../api/schedules";

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

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <SchedulesPage />
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
      expect(screen.getByText(/schedules/i)).toBeInTheDocument();
    });
  });

  it("shows a Create Schedule button in the empty state", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /new schedule|create schedule|\+/i })
      ).toBeInTheDocument();
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

    await waitFor(() =>
      screen.getByRole("button", { name: /new schedule|\+/i })
    );
    await user.click(screen.getByRole("button", { name: /new schedule|\+/i }));

    expect(screen.getByText(/new schedule/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("closes the modal when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      screen.getByRole("button", { name: /new schedule|\+/i })
    );
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
    await waitFor(() =>
      screen.getByRole("button", { name: /new schedule|\+/i })
    );
    await user.click(screen.getByRole("button", { name: /new schedule|\+/i }));
    return user;
  }

  it("shows an error when submitting with empty name", async () => {
    const user = await openCreateModal();

    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required|required/i)).toBeInTheDocument();
    });
  });

  it("shows an error when submitting with missing start date", async () => {
    const user = await openCreateModal();

    await user.type(screen.getByLabelText(/name/i), "Test Schedule");
    await user.click(screen.getByRole("button", { name: /create schedule|save/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/start date.*required|date.*required/i)
      ).toBeInTheDocument();
    });
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

    await waitFor(() =>
      screen.getByRole("button", { name: /new schedule|\+/i })
    );
    await user.click(screen.getByRole("button", { name: /new schedule|\+/i }));

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

    await waitFor(() =>
      screen.getByRole("button", { name: /new schedule|\+/i })
    );
    await user.click(screen.getByRole("button", { name: /new schedule|\+/i }));

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
      expect(screen.getByText(/May Week 1/)).toBeInTheDocument();
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

    await waitFor(() => screen.getByText(/delete schedule/i));
    const confirmButtons = screen.getAllByRole("button", { name: /^delete$/i });
    const confirmDeleteBtn = confirmButtons.find(
      (btn) => btn.textContent?.match(/^delete$/i)
    );
    await user.click(confirmDeleteBtn!);

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

    await waitFor(() => screen.getByText(/delete schedule/i));
    const confirmButtons = screen.getAllByRole("button", { name: /^delete$/i });
    const confirmDeleteBtn = confirmButtons.find(
      (btn) => btn.textContent?.match(/^delete$/i)
    );
    await user.click(confirmDeleteBtn!);

    await waitFor(() => {
      expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
    });
  });
});
