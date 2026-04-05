import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchShifts, fetchEmployees, Shift } from "../api/shifts";
import { WeeklyCalendarGrid, ShiftMoveEvent } from "../components/schedule/WeeklyCalendarGrid";
import { WeekNavigator } from "../components/schedule/WeekNavigator";
import { ShiftFilter, FilterState } from "../components/schedule/ShiftFilter";
import { CopyWeekModal } from "../components/schedule/CopyWeekModal";
import { CopyWeekSpotlight } from "../components/schedule/CopyWeekSpotlight";
import { useCopyWeekSpotlight } from "../hooks/useCopyWeekSpotlight";
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

// A stable ID for the schedule page context — used to track view count for spotlight.
// We use a well-known constant so the page identity is consistent across sessions.
const SCHEDULE_PAGE_ID = "schedule-weekly-view";

export function SchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [filter, setFilter] = useState<FilterState>({});
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const copyWeekBtnRef = useRef<HTMLButtonElement>(null);
  const { showSpotlight, dismissSpotlight, acceptSpotlight } =
    useCopyWeekSpotlight(SCHEDULE_PAGE_ID);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const { data: shifts = [], isLoading, error } = useQuery<Shift[]>({
    queryKey: ["shifts", "week", toDateStr(weekStart)],
    queryFn: () =>
      fetchShifts({ from: toDateStr(weekStart), to: toDateStr(weekEnd) }),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
  });

  function handleShiftMove(event: ShiftMoveEvent) {
    // Parent can handle additional side-effects if needed
    console.debug("Shift moved:", event);
  }

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Schedule</h1>
          <p style={s.subtitle}>Visual team calendar</p>
        </div>
        <button
          ref={copyWeekBtnRef}
          style={s.copyBtn}
          onClick={() => setCopyModalOpen(true)}
          title="Copy this week's schedule to another week"
          data-testid="copy-week-btn"
        >
          Copy Week
        </button>
      </div>

      <div style={s.toolbar}>
        <WeekNavigator currentWeekStart={weekStart} onWeekChange={setWeekStart} />
      </div>

      <div style={s.filterBar}>
        <ShiftFilter
          employees={employees}
          onFilterChange={setFilter}
          activeFilter={filter}
        />
        {(filter.employeeId || filter.role) && (
          <button style={s.clearBtn} onClick={() => setFilter({})}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading && <div style={s.stateMsg}>Loading schedule…</div>}
      {error && (
        <div style={{ ...s.stateMsg, color: "#dc2626" }}>
          Failed to load shifts.
        </div>
      )}

      {!isLoading && !error && (
        <WeeklyCalendarGrid
          shifts={shifts}
          weekStart={weekStart}
          onShiftMove={handleShiftMove}
          filter={filter}
        />
      )}

      <CopyWeekModal
        isOpen={copyModalOpen}
        sourceWeekStart={weekStart}
        onClose={() => setCopyModalOpen(false)}
        onSuccess={() => setCopyModalOpen(false)}
      />

      {showSpotlight && (
        <CopyWeekSpotlight
          anchorRef={copyWeekBtnRef}
          onDismiss={dismissSpotlight}
          onTryItNow={() => {
            acceptSpotlight();
            setCopyModalOpen(true);
          }}
        />
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
  copyBtn: {
    padding: "9px 18px",
    background: "#fff",
    color: "#4f46e5",
    border: "1.5px solid #4f46e5",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  toolbar: {
    marginBottom: 16,
    padding: "12px 16px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  filterBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 16,
    padding: "12px 16px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    flexWrap: "wrap" as const,
  },
  clearBtn: {
    padding: "7px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#6b7280",
  },
  stateMsg: {
    textAlign: "center" as const,
    padding: 40,
    color: "#6b7280",
    fontSize: 14,
  },
};
