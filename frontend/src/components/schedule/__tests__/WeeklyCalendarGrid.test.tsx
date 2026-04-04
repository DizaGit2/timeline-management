/**
 * TIM-72 — Visual Schedule Builder QA
 * Test suite: WeeklyCalendarGrid rendering
 *
 * Tests that the weekly calendar grid correctly displays shifts in the right
 * day/time columns and renders shift block metadata accurately.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WeeklyCalendarGrid } from "../WeeklyCalendarGrid";
import { mockShifts, WEEK_START } from "../../../test/fixtures";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("WeeklyCalendarGrid — Rendering", () => {
  it("renders a 7-column grid with day headers (Sun–Sat)", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={[]} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.forEach((day) => {
      expect(screen.getByText(new RegExp(day, "i"))).toBeInTheDocument();
    });
  });

  it("renders each shift in the correct day column", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    // shift-1 is on Tuesday 2026-04-07 (index 3 = Tue in Sun-indexed week)
    const tuesdayCol = screen.getByTestId("day-col-3");
    expect(within(tuesdayCol).getByText("Morning Shift")).toBeInTheDocument();

    // shift-3 is on Thursday 2026-04-09
    const thursdayCol = screen.getByTestId("day-col-5");
    expect(within(thursdayCol).getByText(/Morning Shift/i)).toBeInTheDocument();
  });

  it("shows shift title on each shift block", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    expect(screen.getAllByText("Morning Shift")).toHaveLength(2);
    expect(screen.getByText("Evening Shift")).toBeInTheDocument();
  });

  it("shows the assigned employee name on each shift block", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
    expect(screen.getByText(/Carol White/i)).toBeInTheDocument();
  });

  it("shows the shift time range on each block", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    // shift-1: 08:00 – 16:00
    expect(screen.getAllByText(/8:00|08:00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/16:00|4:00 PM/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders an empty state message when no shifts exist for the week", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={[]} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    expect(screen.getByText(/no shifts/i)).toBeInTheDocument();
  });

  it("renders shifts only within the displayed week — out-of-range shifts are not shown", () => {
    const outOfRangeShift = {
      ...mockShifts[0],
      id: "shift-out",
      startTime: "2026-04-13T08:00:00.000Z", // following Monday
      endTime: "2026-04-13T16:00:00.000Z",
      title: "Out of Range Shift",
    };

    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={[...mockShifts, outOfRangeShift]}
        weekStart={WEEK_START}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.queryByText("Out of Range Shift")).not.toBeInTheDocument();
  });

  it("renders unassigned shifts with an 'Unassigned' label", () => {
    const unassigned = {
      ...mockShifts[0],
      id: "shift-unassigned",
      title: "Unassigned Shift",
      employeeId: null,
      employee: null,
    };

    renderWithQuery(
      <WeeklyCalendarGrid shifts={[unassigned]} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    expect(screen.getByText("Unassigned Shift")).toBeInTheDocument();
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
  });

  it("shows multiple shifts in the same day column when they exist", () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={vi.fn()} />
    );

    // shift-1 and shift-2 are both on Tuesday
    const tuesdayCol = screen.getByTestId("day-col-3");
    expect(within(tuesdayCol).getAllByTestId(/shift-block/)).toHaveLength(2);
  });
});
