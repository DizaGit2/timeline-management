/**
 * TIM-72 — Visual Schedule Builder QA
 * Test suite: Drag and Drop
 *
 * Tests that dragging a shift block updates the shift via PUT /api/shifts/:id
 * and that the UI rolls back on API failure (optimistic update + rollback).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { WeeklyCalendarGrid } from "../WeeklyCalendarGrid";
import { mockShifts, WEEK_START } from "../../../test/fixtures";
import { server } from "../../../test/msw-server";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("WeeklyCalendarGrid — Drag and Drop", () => {
  let onShiftMove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onShiftMove = vi.fn();
  });

  it("calls onShiftMove with new day when a shift is dragged to a different day column", async () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={onShiftMove} />
    );

    // Simulate dnd-kit drag-end event
    await act(async () => {
      screen.getByTestId("shift-block-shift-1").dispatchEvent(
        new CustomEvent("dnd-drag-end", {
          bubbles: true,
          detail: { shiftId: "shift-1", targetDayIndex: 4 }, // Wednesday (0=Sun)
        })
      );
    });

    await waitFor(() => {
      expect(onShiftMove).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: "shift-1",
          newDate: expect.stringContaining("2026-04-08"), // Wednesday
        })
      );
    });
  });

  it("calls onShiftMove with updated time slot when dragged to a new hour row", async () => {
    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={onShiftMove} />
    );

    await act(async () => {
      screen.getByTestId("shift-block-shift-1").dispatchEvent(
        new CustomEvent("dnd-drag-end", {
          bubbles: true,
          detail: { shiftId: "shift-1", targetDayIndex: 3, targetHour: 10 }, // 10:00 start
        })
      );
    });

    await waitFor(() => {
      expect(onShiftMove).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: "shift-1",
          newStartTime: expect.stringContaining("T10:00"),
          newEndTime: expect.stringContaining("T18:00"), // 8h duration preserved
        })
      );
    });
  });

  it("applies an optimistic UI update before the API responds", async () => {
    // Slow the API response so we can observe the intermediate state
    server.use(
      http.put("/api/shifts/shift-1", async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json(mockShifts[0]);
      })
    );

    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={onShiftMove} />
    );

    act(() => {
      screen.getByTestId("shift-block-shift-1").dispatchEvent(
        new CustomEvent("dnd-drag-end", {
          bubbles: true,
          detail: { shiftId: "shift-1", targetDayIndex: 4 }, // move to Wednesday
        })
      );
    });

    // Should immediately appear in Wednesday column (optimistic)
    await waitFor(() => {
      const wednesdayCol = screen.getByTestId("day-col-4");
      expect(wednesdayCol).toContainElement(screen.getByTestId("shift-block-shift-1"));
    });
  });

  it("rolls back the shift to its original column on API failure", async () => {
    server.use(
      http.put("/api/shifts/shift-1", () =>
        HttpResponse.json({ error: "Internal Server Error" }, { status: 500 })
      )
    );

    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={onShiftMove} />
    );

    // shift-1 starts in Tuesday (index 3)
    const originalCol = screen.getByTestId("day-col-3");
    expect(originalCol).toContainElement(screen.getByTestId("shift-block-shift-1"));

    act(() => {
      screen.getByTestId("shift-block-shift-1").dispatchEvent(
        new CustomEvent("dnd-drag-end", {
          bubbles: true,
          detail: { shiftId: "shift-1", targetDayIndex: 5 }, // try Thursday
        })
      );
    });

    // After API failure, shift should be back in Tuesday
    await waitFor(() => {
      expect(screen.getByTestId("day-col-3")).toContainElement(
        screen.getByTestId("shift-block-shift-1")
      );
    });
  });

  it("displays an error notification when the drag API call fails", async () => {
    server.use(
      http.put("/api/shifts/:id", () =>
        HttpResponse.json({ error: "Service unavailable" }, { status: 503 })
      )
    );

    renderWithQuery(
      <WeeklyCalendarGrid shifts={mockShifts} weekStart={WEEK_START} onShiftMove={onShiftMove} />
    );

    act(() => {
      screen.getByTestId("shift-block-shift-1").dispatchEvent(
        new CustomEvent("dnd-drag-end", {
          bubbles: true,
          detail: { shiftId: "shift-1", targetDayIndex: 5 },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/failed|could not move|error/i);
    });
  });

  it("does not allow dragging when the user is not a manager (read-only mode)", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        onShiftMove={onShiftMove}
        readOnly={true}
      />
    );

    // Shift blocks should not have draggable attribute
    const shiftBlock = screen.getByTestId("shift-block-shift-1");
    expect(shiftBlock).not.toHaveAttribute("draggable", "true");
  });
});
