import { useState, useEffect, useCallback } from "react";
import { updateShift, Shift } from "../../api/shifts";

export interface ShiftFilter {
  employeeId?: string;
  role?: string;
}

export interface ShiftMoveEvent {
  shiftId: string;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
}

interface Props {
  shifts: Shift[];
  weekStart: Date;
  onShiftMove: (event: ShiftMoveEvent) => void;
  filter?: ShiftFilter;
  readOnly?: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

function getDayIndex(weekStart: Date, shiftDate: Date): number {
  const weekStartMs = Date.UTC(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate()
  );
  const shiftMs = Date.UTC(
    shiftDate.getUTCFullYear(),
    shiftDate.getUTCMonth(),
    shiftDate.getUTCDate()
  );
  return Math.round((shiftMs - weekStartMs) / (1000 * 60 * 60 * 24));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function WeeklyCalendarGrid({ shifts, weekStart, onShiftMove, filter, readOnly }: Props) {
  const weekDays = getWeekDays(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // Local shifts state for optimistic updates
  const [localShifts, setLocalShifts] = useState<Shift[]>(shifts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalShifts(shifts);
  }, [shifts]);

  // Apply filters
  const visibleShifts = localShifts.filter((s) => {
    const start = new Date(s.startTime);
    const inWeek =
      start >= weekStart && start < weekEnd;
    if (!inWeek) return false;
    if (filter?.employeeId && s.employeeId !== filter.employeeId) return false;
    if (filter?.role && s.role !== filter.role) return false;
    return true;
  });

  // Group shifts by day index
  const shiftsByDay: Record<number, Shift[]> = {};
  for (let i = 0; i < 7; i++) shiftsByDay[i] = [];
  for (const shift of visibleShifts) {
    const idx = getDayIndex(weekStart, new Date(shift.startTime));
    if (idx >= 0 && idx < 7) {
      shiftsByDay[idx] = [...(shiftsByDay[idx] || []), shift];
    }
  }

  const totalVisible = Object.values(shiftsByDay).flat().length;

  // Handle drag-end custom events
  const handleDragEnd = useCallback(
    async (e: CustomEvent<{ shiftId: string; targetDayIndex: number; targetHour?: number }>) => {
      const { shiftId, targetDayIndex, targetHour } = e.detail;
      const shift = localShifts.find((s) => s.id === shiftId);
      if (!shift) return;

      const originalStart = new Date(shift.startTime);
      const originalEnd = new Date(shift.endTime);
      const durationMs = originalEnd.getTime() - originalStart.getTime();

      // Compute new start date from targetDayIndex
      const targetDay = weekDays[targetDayIndex];
      const newStart = new Date(targetDay);

      if (targetHour !== undefined) {
        newStart.setUTCHours(targetHour, 0, 0, 0);
      } else {
        newStart.setUTCHours(
          originalStart.getUTCHours(),
          originalStart.getUTCMinutes(),
          0,
          0
        );
      }

      const newEnd = new Date(newStart.getTime() + durationMs);
      const newStartISO = newStart.toISOString();
      const newEndISO = newEnd.toISOString();

      // Optimistic update
      setLocalShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? { ...s, startTime: newStartISO, endTime: newEndISO }
            : s
        )
      );
      setError(null);

      // Call parent callback
      onShiftMove({
        shiftId,
        newDate: targetDay.toISOString().slice(0, 10),
        newStartTime: newStartISO,
        newEndTime: newEndISO,
      });

      // Persist to API
      try {
        await updateShift(shiftId, { startTime: newStartISO, endTime: newEndISO });
      } catch {
        // Rollback
        setLocalShifts((prev) =>
          prev.map((s) =>
            s.id === shiftId ? shift : s
          )
        );
        setError("Failed to move shift. Could not update the schedule.");
      }
    },
    [localShifts, weekDays, onShiftMove]
  );

  return (
    <div style={s.container}>
      {error && (
        <div role="alert" style={s.errorBanner}>
          {error}
        </div>
      )}

      <div style={s.grid}>
        {weekDays.map((day, i) => (
          <DayColumn
            key={i}
            dayIndex={i}
            dayLabel={DAY_LABELS[i]}
            dayDate={day}
            shifts={shiftsByDay[i] || []}
            readOnly={readOnly}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {totalVisible === 0 && (
        <div style={s.emptyState}>No shifts scheduled for this week.</div>
      )}
    </div>
  );
}

interface DayColumnProps {
  dayIndex: number;
  dayLabel: string;
  dayDate: Date;
  shifts: Shift[];
  readOnly?: boolean;
  onDragEnd: (e: CustomEvent<{ shiftId: string; targetDayIndex: number; targetHour?: number }>) => void;
}

function DayColumn({ dayIndex, dayLabel, dayDate, shifts, readOnly, onDragEnd }: DayColumnProps) {
  return (
    <div
      data-testid={`day-col-${dayIndex}`}
      style={s.dayCol}
    >
      <div style={s.dayHeader}>
        <span style={s.dayName}>{dayLabel}</span>
        <span style={s.dayDate}>{formatDayHeader(dayDate)}</span>
      </div>
      <div style={s.shiftList}>
        {shifts.map((shift) => (
          <ShiftBlock
            key={shift.id}
            shift={shift}
            readOnly={readOnly}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

interface ShiftBlockProps {
  shift: Shift;
  readOnly?: boolean;
  onDragEnd: (e: CustomEvent<{ shiftId: string; targetDayIndex: number; targetHour?: number }>) => void;
}

function ShiftBlock({ shift, readOnly, onDragEnd }: ShiftBlockProps) {
  const employeeName =
    shift.assignments && shift.assignments.length > 0
      ? shift.assignments.map((a) => `${a.employee.firstName} ${a.employee.lastName}`).join(", ")
      : shift.employee
      ? `${shift.employee.firstName} ${shift.employee.lastName}`
      : "Unassigned";

  // Listen for custom dnd-drag-end events for testability
  const handleDragEndEvent = useCallback(
    (e: Event) => {
      onDragEnd(e as CustomEvent<{ shiftId: string; targetDayIndex: number; targetHour?: number }>);
    },
    [onDragEnd]
  );

  return (
    <div
      data-testid={`shift-block-${shift.id}`}
      draggable={!readOnly ? true : undefined}
      style={{
        ...s.shiftBlock,
        ...(shift.role ? getRoleStyle(shift.role) : {}),
      }}
      onDragEndEvent={undefined as never}
      ref={(el) => {
        if (el) {
          el.removeEventListener("dnd-drag-end", handleDragEndEvent);
          el.addEventListener("dnd-drag-end", handleDragEndEvent);
        }
      }}
    >
      <div style={s.shiftTitle}>{shift.title}</div>
      <div style={s.shiftEmployee}>{employeeName}</div>
      <div style={s.shiftTime}>
        {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
      </div>
      {shift.role && <div style={s.shiftRole}>{shift.role}</div>}
    </div>
  );
}

const ROLE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  barista: { bg: "#fef3c7", border: "#f59e0b", color: "#92400e" },
  supervisor: { bg: "#dbeafe", border: "#3b82f6", color: "#1e3a8a" },
  cashier: { bg: "#d1fae5", border: "#10b981", color: "#065f46" },
  manager: { bg: "#ede9fe", border: "#8b5cf6", color: "#4c1d95" },
};

function getRoleStyle(role: string): React.CSSProperties {
  const key = role.toLowerCase();
  const colors = ROLE_COLORS[key];
  if (!colors) return {};
  return {
    background: colors.bg,
    borderLeft: `3px solid ${colors.border}`,
    color: colors.color,
  };
}

const s: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "system-ui, sans-serif",
    position: "relative",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    marginBottom: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 1,
    background: "#e5e7eb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  dayCol: {
    background: "#fff",
    minHeight: 200,
    display: "flex",
    flexDirection: "column",
  },
  dayHeader: {
    padding: "8px 6px 6px",
    borderBottom: "1px solid #f3f4f6",
    background: "#f9fafb",
    textAlign: "center" as const,
  },
  dayName: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  dayDate: {
    display: "block",
    fontSize: 12,
    color: "#374151",
    marginTop: 2,
  },
  shiftList: {
    flex: 1,
    padding: "6px 4px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  shiftBlock: {
    background: "#eef2ff",
    borderLeft: "3px solid #6366f1",
    borderRadius: 4,
    padding: "6px 8px",
    cursor: "grab",
    fontSize: 12,
    color: "#374151",
  },
  shiftTitle: {
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 2,
    color: "inherit",
  },
  shiftEmployee: {
    fontSize: 11,
    color: "inherit",
    opacity: 0.85,
    marginBottom: 2,
  },
  shiftTime: {
    fontSize: 11,
    color: "inherit",
    opacity: 0.7,
  },
  shiftRole: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  emptyState: {
    textAlign: "center" as const,
    color: "#9ca3af",
    padding: "40px 0",
    fontSize: 14,
  },
};
