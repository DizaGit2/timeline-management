/**
 * TIM-72 — Visual Schedule Builder QA
 * Test suite: ShiftFilter
 *
 * Covers filtering by employee and by role.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShiftFilter } from "../ShiftFilter";
import { WeeklyCalendarGrid } from "../WeeklyCalendarGrid";
import { mockShifts, mockEmployees, WEEK_START } from "../../../test/fixtures";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ShiftFilter — Employee Filter", () => {
  it("renders a dropdown with all employees listed", () => {
    renderWithQuery(
      <ShiftFilter employees={mockEmployees} onFilterChange={vi.fn()} activeFilter={{}} />
    );

    const select = screen.getByRole("combobox", { name: /employee/i });
    expect(select).toBeInTheDocument();

    mockEmployees.forEach((emp) => {
      expect(
        within(select).getByRole("option", { name: new RegExp(emp.firstName, "i") })
      ).toBeInTheDocument();
    });
  });

  it("includes an 'All Employees' default option", () => {
    renderWithQuery(
      <ShiftFilter employees={mockEmployees} onFilterChange={vi.fn()} activeFilter={{}} />
    );

    expect(screen.getByRole("option", { name: /all employees/i })).toBeInTheDocument();
  });

  it("calls onFilterChange with the selected employee id", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    renderWithQuery(
      <ShiftFilter employees={mockEmployees} onFilterChange={onFilterChange} activeFilter={{}} />
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: /employee/i }),
      "emp-1"
    );

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "emp-1" })
    );
  });

  it("grid shows only Alice's shifts when employee filter is set to Alice", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        filter={{ employeeId: "emp-1" }}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Jones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol White/i)).not.toBeInTheDocument();
  });

  it("grid shows all shifts when employee filter is cleared", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        filter={{}}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
    expect(screen.getByText(/Carol White/i)).toBeInTheDocument();
  });
});

describe("ShiftFilter — Role Filter", () => {
  it("renders a dropdown with all unique roles from shifts", () => {
    renderWithQuery(
      <ShiftFilter employees={mockEmployees} onFilterChange={vi.fn()} activeFilter={{}} />
    );

    const roleSelect = screen.getByRole("combobox", { name: /role/i });
    expect(roleSelect).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: /barista/i })).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: /supervisor/i })).toBeInTheDocument();
    expect(within(roleSelect).getByRole("option", { name: /cashier/i })).toBeInTheDocument();
  });

  it("calls onFilterChange with the selected role", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    renderWithQuery(
      <ShiftFilter employees={mockEmployees} onFilterChange={onFilterChange} activeFilter={{}} />
    );

    await user.selectOptions(screen.getByRole("combobox", { name: /role/i }), "Barista");

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ role: "Barista" })
    );
  });

  it("grid shows only Barista shifts when role filter is set", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        filter={{ role: "Barista" }}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bob Jones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol White/i)).not.toBeInTheDocument();
  });

  it("grid shows only Supervisor shifts when role filter is Supervisor", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        filter={{ role: "Supervisor" }}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.getByText(/Bob Jones/i)).toBeInTheDocument();
    expect(screen.queryByText(/Alice Smith/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carol White/i)).not.toBeInTheDocument();
  });

  it("shows an empty state when no shifts match the active filter", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        filter={{ role: "Cook" }}
        onShiftMove={vi.fn()}
      />
    );

    expect(screen.getByText(/no shifts/i)).toBeInTheDocument();
  });

  it("employee and role filters combine additively (AND logic)", () => {
    renderWithQuery(
      <WeeklyCalendarGrid
        shifts={mockShifts}
        weekStart={WEEK_START}
        filter={{ employeeId: "emp-1", role: "Supervisor" }} // Alice is a Barista, not Supervisor
        onShiftMove={vi.fn()}
      />
    );

    // No shifts match both criteria
    expect(screen.queryByText(/Alice Smith/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no shifts/i)).toBeInTheDocument();
  });
});
