import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchShifts, Shift } from "../api/shifts";
import { WeeklyCalendarGrid } from "../components/schedule/WeeklyCalendarGrid";
import { WeekNavigator } from "../components/schedule/WeekNavigator";
import { Navbar } from "../components/Navbar";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function MySchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [view, setView] = useState<"week" | "month">("week");

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const { data: shifts = [], isLoading, error } = useQuery<Shift[]>({
    queryKey: ["my-shifts", toDateStr(weekStart)],
    queryFn: () =>
      fetchShifts({
        employeeId: "me",
        from: toDateStr(weekStart),
        to: toDateStr(weekEnd),
      }),
    enabled: view === "week",
  });

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>My Schedule</h1>
          <p style={s.subtitle}>Your upcoming shifts</p>
        </div>
        <div style={s.viewToggle}>
          <button
            style={view === "week" ? s.toggleActive : s.toggleInactive}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            style={view === "month" ? s.toggleActive : s.toggleInactive}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
      </div>

      {view === "month" ? (
        <div data-testid="month-view-placeholder" style={s.placeholder}>
          Month view coming soon
        </div>
      ) : (
        <>
          <div style={s.toolbar}>
            <WeekNavigator
              currentWeekStart={weekStart}
              onWeekChange={setWeekStart}
            />
          </div>

          {isLoading && <div style={s.stateMsg}>Loading your schedule...</div>}
          {error && (
            <div style={{ ...s.stateMsg, color: "#dc2626" }}>
              Failed to load your schedule.
            </div>
          )}

          {!isLoading && !error && (
            <WeeklyCalendarGrid
              shifts={shifts}
              weekStart={weekStart}
              onShiftMove={() => {
                // read-only — no-op
              }}
              readOnly
            />
          )}
        </>
      )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageWrapper: { minHeight: "100vh", background: "#f8fafc" },
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  pageTitle: {
    margin: "0 0 4px",
    fontSize: 26,
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: { margin: 0, color: "#6b7280", fontSize: 14 },
  viewToggle: {
    display: "flex",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    overflow: "hidden",
  },
  toggleActive: {
    padding: "8px 18px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  toggleInactive: {
    padding: "8px 18px",
    background: "#fff",
    color: "#374151",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
  },
  toolbar: {
    marginBottom: 16,
    padding: "12px 16px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  stateMsg: {
    textAlign: "center" as const,
    padding: 40,
    color: "#6b7280",
    fontSize: 14,
  },
  placeholder: {
    textAlign: "center" as const,
    padding: "80px 0",
    color: "#6b7280",
    fontSize: 16,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    marginTop: 16,
  },
};
