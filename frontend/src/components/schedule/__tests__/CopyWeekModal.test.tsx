/**
 * TIM-72 — Visual Schedule Builder QA
 * Test suite: CopyWeekModal
 *
 * Covers the "copy week" flow: confirming a copy duplicates all shifts to the
 * target week; attempting to copy to a week that already has shifts returns an error.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { CopyWeekModal } from "../CopyWeekModal";
import { WEEK_START } from "../../../test/fixtures";
import { server } from "../../../test/msw-server";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const NEXT_WEEK_START = new Date("2026-04-13T00:00:00.000Z");

describe("CopyWeekModal — Copy Week", () => {
  it("renders a confirmation dialog when opened", () => {
    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/copy week/i)).toBeInTheDocument();
  });

  it("shows the source week and a target week picker", () => {
    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Shows source week
    expect(screen.getByText(/Apr.*6.*2026|2026-04-06/i)).toBeInTheDocument();
    // Shows target week input
    expect(screen.getByLabelText(/target week|copy to/i)).toBeInTheDocument();
  });

  it("calls POST /api/schedules/copy-week and invokes onSuccess when confirmed", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    const targetInput = screen.getByLabelText(/target week|copy to/i);
    await user.clear(targetInput);
    await user.type(targetInput, "2026-04-13");

    await user.click(screen.getByRole("button", { name: /confirm|copy/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });

    // onSuccess receives the new copies
    const [arg] = onSuccess.mock.calls[0];
    expect(arg.shifts).toHaveLength(3); // all 3 mock shifts copied
  });

  it("displays an error when target week already has shifts (409 conflict)", async () => {
    server.use(
      http.post("/api/schedules/copy-week", () =>
        HttpResponse.json(
          { error: "Target week already has shifts" },
          { status: 409 }
        )
      )
    );

    const user = userEvent.setup();

    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const targetInput = screen.getByLabelText(/target week|copy to/i);
    await user.clear(targetInput);
    await user.type(targetInput, "2026-04-13");

    await user.click(screen.getByRole("button", { name: /confirm|copy/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/already has shifts|conflict/i);
    });
  });

  it("disables the confirm button when no target week is selected", () => {
    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /confirm|copy/i })).toBeDisabled();
  });

  it("calls onClose when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render when isOpen is false", () => {
    renderWithQuery(
      <CopyWeekModal
        isOpen={false}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a loading state while the copy request is in flight", async () => {
    server.use(
      http.post("/api/schedules/copy-week", async () => {
        await new Promise((r) => setTimeout(r, 300));
        return HttpResponse.json({ shifts: [] }, { status: 201 });
      })
    );

    const user = userEvent.setup();

    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const targetInput = screen.getByLabelText(/target week|copy to/i);
    await user.clear(targetInput);
    await user.type(targetInput, "2026-04-13");
    await user.click(screen.getByRole("button", { name: /confirm|copy/i }));

    // Should show spinner/loading state while request is pending
    expect(
      screen.getByRole("button", { name: /copying|loading|please wait/i }) ||
        screen.getByTestId("copy-loading-spinner")
    ).toBeInTheDocument();
  });

  it("prevents copying a week to itself", async () => {
    const user = userEvent.setup();

    renderWithQuery(
      <CopyWeekModal
        isOpen={true}
        sourceWeekStart={WEEK_START}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Set target to same week as source
    const targetInput = screen.getByLabelText(/target week|copy to/i);
    await user.clear(targetInput);
    await user.type(targetInput, "2026-04-06");

    expect(screen.getByRole("button", { name: /confirm|copy/i })).toBeDisabled();
    expect(screen.getByText(/same week|cannot copy to itself/i)).toBeInTheDocument();
  });
});
