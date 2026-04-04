/**
 * TIM-72 — Visual Schedule Builder QA
 * Test suite: WeekNavigator — week navigation controls
 *
 * Covers prev/next week navigation and jump-to-date functionality.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeekNavigator } from "../WeekNavigator";
import { WEEK_START } from "../../../test/fixtures";

describe("WeekNavigator — Navigation", () => {
  it("displays the current week date range", () => {
    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={vi.fn()} />);

    // Should show something like "Apr 6 – Apr 12, 2026"
    expect(screen.getByText(/Apr.*6/i)).toBeInTheDocument();
    expect(screen.getByText(/Apr.*12/i)).toBeInTheDocument();
  });

  it("calls onWeekChange with the previous week start when '← Prev' is clicked", async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();

    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={onWeekChange} />);

    await user.click(screen.getByRole("button", { name: /prev(ious)?|←|</i }));

    expect(onWeekChange).toHaveBeenCalledOnce();
    const calledWith: Date = onWeekChange.mock.calls[0][0];
    // Previous week start = 2026-03-30 (Sun)
    expect(calledWith.toISOString().startsWith("2026-03-30")).toBe(true);
  });

  it("calls onWeekChange with the next week start when 'Next →' is clicked", async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();

    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={onWeekChange} />);

    await user.click(screen.getByRole("button", { name: /next|→|>/i }));

    expect(onWeekChange).toHaveBeenCalledOnce();
    const calledWith: Date = onWeekChange.mock.calls[0][0];
    // Next week start = 2026-04-13 (Sun)
    expect(calledWith.toISOString().startsWith("2026-04-13")).toBe(true);
  });

  it("renders a date picker for jumping to a specific date", () => {
    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={vi.fn()} />);

    expect(
      screen.getByRole("textbox", { name: /date|jump/i }) ||
        screen.getByLabelText(/date|jump/i) ||
        screen.getByDisplayValue(/2026-04-06/i) ||
        screen.getByPlaceholderText(/date/i)
    ).toBeInTheDocument();
  });

  it("calls onWeekChange with the week containing the chosen date when a date is entered", async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();

    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={onWeekChange} />);

    const datePicker = screen.getByLabelText(/go to date|jump to date/i);
    await user.clear(datePicker);
    await user.type(datePicker, "2026-05-01");
    await user.keyboard("{Enter}");

    expect(onWeekChange).toHaveBeenCalledOnce();
    const calledWith: Date = onWeekChange.mock.calls[0][0];
    // 2026-05-01 (Friday) → week start is 2026-04-26 (Sun)
    expect(calledWith.toISOString().startsWith("2026-04-26")).toBe(true);
  });

  it("renders a 'Today' button that jumps to the current week", async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();

    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={onWeekChange} />);

    await user.click(screen.getByRole("button", { name: /today/i }));

    expect(onWeekChange).toHaveBeenCalledOnce();
  });

  it("prev/next buttons are keyboard-accessible", async () => {
    render(<WeekNavigator currentWeekStart={WEEK_START} onWeekChange={vi.fn()} />);

    const prevBtn = screen.getByRole("button", { name: /prev(ious)?|←|</i });
    const nextBtn = screen.getByRole("button", { name: /next|→|>/i });

    expect(prevBtn).not.toHaveAttribute("tabindex", "-1");
    expect(nextBtn).not.toHaveAttribute("tabindex", "-1");
  });
});
