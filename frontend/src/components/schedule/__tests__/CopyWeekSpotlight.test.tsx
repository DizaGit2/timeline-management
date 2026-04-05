/**
 * TIM-187 — Copy-week button elevation and onboarding spotlight UI
 * Test suite: CopyWeekSpotlight + useCopyWeekSpotlight
 *
 * Covers:
 * - Spotlight renders with correct ARIA attributes
 * - "Got it, thanks" dismisses the spotlight and persists to localStorage
 * - "Try it now" calls onTryItNow and also persists dismissal
 * - Escape key dismisses the spotlight
 * - Clicking the scrim dismisses the spotlight
 * - useCopyWeekSpotlight trigger logic (second unique schedule shows spotlight)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { renderHook, act } from "@testing-library/react";
import { CopyWeekSpotlight } from "../CopyWeekSpotlight";
import { useCopyWeekSpotlight } from "../../../hooks/useCopyWeekSpotlight";

// ---------------------------------------------------------------------------
// CopyWeekSpotlight component tests
// ---------------------------------------------------------------------------

function renderSpotlight(overrides?: Partial<React.ComponentProps<typeof CopyWeekSpotlight>>) {
  const ref = createRef<HTMLButtonElement>();
  const props = {
    anchorRef: ref,
    onDismiss: vi.fn(),
    onTryItNow: vi.fn(),
    ...overrides,
  };
  return { ...render(<CopyWeekSpotlight {...props} />), props };
}

describe("CopyWeekSpotlight", () => {
  it("renders with role=dialog and aria-modal=true", () => {
    renderSpotlight();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders headline and body copy", () => {
    renderSpotlight();
    expect(screen.getByText(/Save time with Copy Week/i)).toBeInTheDocument();
    expect(screen.getByText(/duplicate this week.*shifts/i)).toBeInTheDocument();
  });

  it("calls onDismiss when 'Got it, thanks' is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderSpotlight();
    await user.click(screen.getByRole("button", { name: /got it/i }));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onTryItNow when 'Try it now' is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderSpotlight();
    await user.click(screen.getByRole("button", { name: /try it now/i }));
    expect(props.onTryItNow).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when the close (×) button is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderSpotlight();
    await user.click(screen.getByRole("button", { name: /dismiss spotlight/i }));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when the scrim is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderSpotlight();
    await user.click(screen.getByTestId("spotlight-scrim"));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when Escape is pressed", () => {
    const { props } = renderSpotlight();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("does NOT call onDismiss when clicking inside the card", async () => {
    const user = userEvent.setup();
    const { props } = renderSpotlight();
    await user.click(screen.getByTestId("spotlight-card"));
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it("labels the dialog with the headline text", () => {
    renderSpotlight();
    const dialog = screen.getByRole("dialog");
    const headingId = dialog.getAttribute("aria-labelledby");
    expect(headingId).toBeTruthy();
    const heading = document.getElementById(headingId!);
    expect(heading).toHaveTextContent(/Save time with Copy Week/i);
  });
});

// ---------------------------------------------------------------------------
// useCopyWeekSpotlight hook tests
// ---------------------------------------------------------------------------

const DISMISSED_KEY = "ux_spotlight_copy_week_v1";
const VISITED_KEY = "ux_schedules_visited_v1";

describe("useCopyWeekSpotlight", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does not show spotlight on first schedule visit", () => {
    const { result } = renderHook(() => useCopyWeekSpotlight("schedule-1"));
    expect(result.current.showSpotlight).toBe(false);
  });

  it("shows spotlight on second unique schedule visit", () => {
    // Simulate having visited one schedule already
    localStorage.setItem(VISITED_KEY, JSON.stringify(["schedule-1"]));

    const { result } = renderHook(() => useCopyWeekSpotlight("schedule-2"));
    expect(result.current.showSpotlight).toBe(true);
  });

  it("does not show spotlight again after it has been dismissed", () => {
    localStorage.setItem(VISITED_KEY, JSON.stringify(["schedule-1"]));
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ dismissed: true, dismissedAt: new Date().toISOString(), dismissedVia: "got_it" })
    );

    const { result } = renderHook(() => useCopyWeekSpotlight("schedule-2"));
    expect(result.current.showSpotlight).toBe(false);
  });

  it("dismissSpotlight hides the spotlight and writes localStorage", () => {
    localStorage.setItem(VISITED_KEY, JSON.stringify(["schedule-1"]));

    const { result } = renderHook(() => useCopyWeekSpotlight("schedule-2"));
    expect(result.current.showSpotlight).toBe(true);

    act(() => {
      result.current.dismissSpotlight("got_it");
    });

    expect(result.current.showSpotlight).toBe(false);
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY)!);
    expect(stored.dismissed).toBe(true);
    expect(stored.dismissedVia).toBe("got_it");
  });

  it("acceptSpotlight hides the spotlight with 'try_it_now' dismissal reason", () => {
    localStorage.setItem(VISITED_KEY, JSON.stringify(["schedule-1"]));

    const { result } = renderHook(() => useCopyWeekSpotlight("schedule-2"));
    expect(result.current.showSpotlight).toBe(true);

    act(() => {
      result.current.acceptSpotlight();
    });

    expect(result.current.showSpotlight).toBe(false);
    const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY)!);
    expect(stored.dismissedVia).toBe("try_it_now");
  });

  it("does not show spotlight on third or later visits if not yet dismissed", () => {
    // visited 3 schedules already — count > 2, spotlight should NOT re-appear
    localStorage.setItem(
      VISITED_KEY,
      JSON.stringify(["schedule-1", "schedule-2", "schedule-3"])
    );

    const { result } = renderHook(() => useCopyWeekSpotlight("schedule-4"));
    expect(result.current.showSpotlight).toBe(false);
  });
});
