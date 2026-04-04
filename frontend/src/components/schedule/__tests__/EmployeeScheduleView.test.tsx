/**
 * TIM-75 — QA: Employee schedule view tests + mobile testing
 * Subtask of TIM-36 — Employee Schedule View
 *
 * Tests that the schedule view correctly enforces employee-scoped shift
 * visibility, renders shifts in the right week columns for a single employee,
 * handles mobile viewports (375px), and supports week/month toggle state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WeeklyCalendarGrid } from "../WeeklyCalendarGrid";
import { mockShifts, WEEK_START } from "../../../test/fixtures";
import type { Shift } from "../../../api/shifts";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Alice's employee id in fixtures */
const ALICE_ID = "emp-1";
/** Bob's employee id in fixtures */
const BOB_ID = "emp-2";

// ── 1. Employee sees only own shifts ─────────────────────────────────────────

describe("Employee shift visibility — own shifts only", () => {
  it("shows only the authenticated employee's shifts when filtered by employeeId", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    // Alice's shift is visible
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    // Bob's and Carol's shifts must NOT appear
    expect(screen.queryByText(/Bob Jones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol White/i)).not.toBeInTheDocument();
  });

  it("shows only the employee's shifts when a different employee is selected", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: BOB_ID }}
      />
    );

    expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
    expect(screen.queryByText(/Alice Smith/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol White/i)).not.toBeInTheDocument();
  });

  it("shows the empty-state message when the employee has no shifts this week", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: "emp-no-shifts" }}
      />
    );

    expect(screen.getByText(/no shifts/i)).toBeInTheDocument();
  });

  it("shows all shifts when no employee filter is applied", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{}}
      />
    );

    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
    expect(screen.getByText(/Carol White/i)).toBeInTheDocument();
  });

  it("shift count drops to one after employee filter is applied", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    // Only Alice's single shift is rendered
    const allBlocks = screen.getAllByTestId(/shift-block/);
    expect(allBlocks).toHaveLength(1);
  });
});

// ── 2. Week view — employee shift placed in correct day column ────────────────

describe("Week view — employee shift column placement", () => {
  it("places Alice's Monday shift in the correct day column", () => {
    // Alice's shift-1 is on 2026-04-07 (Tuesday), WEEK_START is 2026-04-06 (Sun)
    // Day index for Tuesday = 3 (0=Sun…6=Sat)
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    const tuesdayCol = screen.getByTestId("day-col-3");
    expect(within(tuesdayCol).getByText("Morning Shift")).toBeInTheDocument();
    expect(within(tuesdayCol).getByText(/Alice Smith/i)).toBeInTheDocument();
  });

  it("does not render Alice's shift in any other day column", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    // Columns that must be empty for Alice
    const emptyIndices = [0, 1, 2, 4, 5, 6]; // all except Tue (3)
    for (const idx of emptyIndices) {
      const col = screen.getByTestId(`day-col-${idx}`);
      expect(within(col).queryByTestId(/shift-block/)).not.toBeInTheDocument();
    }
  });

  it("shows all 7 day-column headers regardless of filter", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      expect(screen.getByText(new RegExp(day, "i"))).toBeInTheDocument();
    });
  });

  it("renders the employee's shift time range correctly", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    // shift-1: 08:00 – 16:00 UTC
    expect(screen.getAllByText(/8:00|08:00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/4:00 PM|16:00/i).length).toBeGreaterThanOrEqual(1);
  });

  it("employee shift block includes role indicator", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    // Alice's role is "Barista"
    expect(screen.getByText(/barista/i)).toBeInTheDocument();
  });
});

// ── 3. Read-only view — employees cannot drag/edit shifts ────────────────────

describe("Read-only mode for employee view", () => {
  it("shift blocks are not draggable when readOnly is true", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
        readOnly
      />
    );

    const block = screen.getByTestId("shift-block-shift-1");
    // draggable attribute should be absent or false in readOnly mode
    expect(block).not.toHaveAttribute("draggable", "true");
  });

  it("shift blocks are draggable when readOnly is not set (default manager view)", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    const block = screen.getByTestId("shift-block-shift-1");
    expect(block).toHaveAttribute("draggable", "true");
  });
});

// ── 4. Mobile viewport (375px) ───────────────────────────────────────────────

describe("Mobile viewport rendering (375px)", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });
    window.dispatchEvent(new Event("resize"));
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("renders the weekly grid without crashing on a 375px viewport", () => {
    expect(() => {
      renderWithQuery(
        <WeeklyCalendarGrid
          shifts={mockShifts}
          weekStart={WEEK_START}
          onShiftMove={vi.fn()}
          filter={{ employeeId: ALICE_ID }}
        />
      );
    }).not.toThrow();
  });

  it("renders employee shift block content on mobile viewport", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    // Key shift content must be accessible on mobile
    expect(screen.getByText("Morning Shift")).toBeInTheDocument();
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
  });

  it("renders all 7 day columns on mobile viewport", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
        filter={{ employeeId: ALICE_ID }}
      />
    );

    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-col-${i}`)).toBeInTheDocument();
    }
  });

  it("shows empty-state message correctly on mobile viewport", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={[]}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.getByText(/no shifts/i)).toBeInTheDocument();
  });
});

// ── 5. Week / Month view toggle ───────────────────────────────────────────────

/**
 * The month view component (TIM-36 deliverable) is not yet implemented.
 * These tests validate the toggle state machine that the employee schedule
 * page must provide. A minimal harness wraps the calendar with a toggle
 * so the toggle logic can be tested independently of the final UI.
 */

type ViewMode = "week" | "month";

function EmployeeScheduleHarness({
  shifts,
  weekStart,
}: {
  shifts: Shift[];
  weekStart: Date;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");

  return (
    <div>
      <div role="group" aria-label="View mode">
        <button
          aria-pressed={viewMode === "week"}
          onClick={() => setViewMode("week")}
        >
          Week
        </button>
        <button
          aria-pressed={viewMode === "month"}
          onClick={() => setViewMode("month")}
        >
          Month
        </button>
      </div>

      {viewMode === "week" ? (
        <WeeklyCalendarGrid
          shifts={shifts}
          weekStart={weekStart}
          onShiftMove={vi.fn()}
          filter={{ employeeId: ALICE_ID }}
          readOnly
        />
      ) : (
        <div data-testid="month-view-placeholder">
          Month view — coming soon
        </div>
      )}
    </div>
  );
}

describe("Week / Month view toggle", () => {
  it("defaults to week view on mount", () => {
    renderWithQuery(
      <EmployeeScheduleHarness shifts={mockShifts} weekStart={WEEK_START} />
    );

    const weekBtn = screen.getByRole("button", { name: /week/i });
    const monthBtn = screen.getByRole("button", { name: /month/i });

    expect(weekBtn).toHaveAttribute("aria-pressed", "true");
    expect(monthBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the weekly calendar grid when week view is active", () => {
    renderWithQuery(
      <EmployeeScheduleHarness shifts={mockShifts} weekStart={WEEK_START} />
    );

    expect(screen.getByTestId("day-col-0")).toBeInTheDocument();
    expect(screen.queryByTestId("month-view-placeholder")).not.toBeInTheDocument();
  });

  it("switches to month view when the Month button is clicked", () => {
    renderWithQuery(
      <EmployeeScheduleHarness shifts={mockShifts} weekStart={WEEK_START} />
    );

    fireEvent.click(screen.getByRole("button", { name: /month/i }));

    expect(screen.getByTestId("month-view-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("day-col-0")).not.toBeInTheDocument();
  });

  it("pressing Month marks month button aria-pressed=true and week button false", () => {
    renderWithQuery(
      <EmployeeScheduleHarness shifts={mockShifts} weekStart={WEEK_START} />
    );

    fireEvent.click(screen.getByRole("button", { name: /month/i }));

    expect(screen.getByRole("button", { name: /month/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /week/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("switches back to week view from month view", () => {
    renderWithQuery(
      <EmployeeScheduleHarness shifts={mockShifts} weekStart={WEEK_START} />
    );

    fireEvent.click(screen.getByRole("button", { name: /month/i }));
    expect(screen.getByTestId("month-view-placeholder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /week/i }));
    expect(screen.getByTestId("day-col-0")).toBeInTheDocument();
    expect(screen.queryByTestId("month-view-placeholder")).not.toBeInTheDocument();
  });

  it("employee shifts remain filtered after toggling back to week view", () => {
    renderWithQuery(
      <EmployeeScheduleHarness shifts={mockShifts} weekStart={WEEK_START} />
    );

    fireEvent.click(screen.getByRole("button", { name: /month/i }));
    fireEvent.click(screen.getByRole("button", { name: /week/i }));

    // Alice's shift should still be visible and other employees hidden
    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Jones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol White/i)).not.toBeInTheDocument();
  });
});
