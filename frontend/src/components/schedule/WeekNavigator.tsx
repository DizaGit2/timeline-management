interface Props {
  currentWeekStart: Date;
  onWeekChange: (newWeekStart: Date) => void;
}

function getWeekStart(date: Date): Date {
  // Returns the Sunday of the week containing date (UTC)
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d;
}

function formatWeekRange(weekStart: Date): { start: string; end: string } {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const yearOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };

  return {
    start: weekStart.toLocaleDateString("en-US", opts),
    end: weekEnd.toLocaleDateString("en-US", yearOpts),
  };
}

function toInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function WeekNavigator({ currentWeekStart, onWeekChange }: Props) {
  const { start, end } = formatWeekRange(currentWeekStart);

  function handlePrev() {
    onWeekChange(addWeeks(currentWeekStart, -1));
  }

  function handleNext() {
    onWeekChange(addWeeks(currentWeekStart, 1));
  }

  function handleToday() {
    onWeekChange(getWeekStart(new Date()));
  }

  function handleDateKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const input = e.currentTarget;
      if (!input.value) return;
      const picked = new Date(input.value + "T00:00:00.000Z");
      onWeekChange(getWeekStart(picked));
    }
  }

  return (
    <div style={s.container}>
      <button
        style={s.navBtn}
        onClick={handlePrev}
        aria-label="Previous week"
      >
        ← Prev
      </button>

      <div style={s.weekLabel}>
        <span style={s.weekRange}>
          {start} – {end}
        </span>
      </div>

      <button
        style={s.navBtn}
        onClick={handleNext}
        aria-label="Next week"
      >
        Next →
      </button>

      <button style={s.todayBtn} onClick={handleToday}>
        Today
      </button>

      <label style={s.dateLabel}>
        <span style={s.dateLabelText}>Go to date</span>
        <input
          type="text"
          role="textbox"
          aria-label="Go to date"
          style={s.dateInput}
          defaultValue={toInputValue(currentWeekStart)}
          onKeyDown={handleDateKeyDown}
        />
      </label>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
    fontFamily: "system-ui, sans-serif",
  },
  navBtn: {
    padding: "7px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  todayBtn: {
    padding: "7px 12px",
    border: "1px solid #6366f1",
    borderRadius: 6,
    background: "#eef2ff",
    color: "#4338ca",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  weekLabel: {
    flex: 1,
    textAlign: "center" as const,
  },
  weekRange: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
  },
  dateLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "#6b7280",
  },
  dateLabelText: {
    whiteSpace: "nowrap" as const,
  },
  dateInput: {
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    color: "#374151",
    fontFamily: "inherit",
  },
};
