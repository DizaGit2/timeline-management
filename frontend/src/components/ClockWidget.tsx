import { useClockInOut } from "../hooks/useClockInOut";

export function ClockWidget() {
  const { clockState, isOnline, pendingCount, syncState, isBusy, clock } =
    useClockInOut();

  const isClockedIn = clockState === "clocked_in";
  const isUnknown = clockState === "unknown";

  return (
    <div style={s.card}>
      {/* Offline banner */}
      {!isOnline && (
        <div style={s.offlineBanner}>
          <span style={s.offlineDot} />
          You are offline — clock actions will sync automatically when you reconnect.
        </div>
      )}

      {/* Main content */}
      <div style={s.body}>
        {/* Status indicator */}
        <div style={s.statusRow}>
          <span
            style={{
              ...s.statusDot,
              background: isUnknown
                ? "#d1d5db"
                : isClockedIn
                ? "#22c55e"
                : "#6b7280",
            }}
          />
          <span style={s.statusText}>
            {isUnknown
              ? "Status unknown"
              : isClockedIn
              ? "Clocked in"
              : "Clocked out"}
          </span>

          {/* Sync status badge */}
          {pendingCount > 0 && (
            <span style={s.pendingBadge}>
              {pendingCount} pending
            </span>
          )}
          {syncState === "syncing" && (
            <span style={s.syncingBadge}>Syncing…</span>
          )}
          {syncState === "synced" && pendingCount === 0 && (
            <span style={s.syncedBadge}>✓ Synced</span>
          )}
          {syncState === "error" && (
            <span style={s.errorBadge}>Sync error</span>
          )}
        </div>

        {/* Action buttons */}
        <div style={s.actions}>
          <button
            style={{
              ...s.btn,
              ...s.btnClockIn,
              ...(isClockedIn || isBusy ? s.btnDisabled : {}),
            }}
            disabled={isClockedIn || isBusy || isUnknown}
            onClick={() => clock("CLOCK_IN")}
            aria-label="Clock in"
          >
            {isBusy && !isClockedIn ? "…" : "Clock In"}
          </button>
          <button
            style={{
              ...s.btn,
              ...s.btnClockOut,
              ...(!isClockedIn || isBusy ? s.btnDisabled : {}),
            }}
            disabled={!isClockedIn || isBusy}
            onClick={() => clock("CLOCK_OUT")}
            aria-label="Clock out"
          >
            {isBusy && isClockedIn ? "…" : "Clock Out"}
          </button>
        </div>

        {/* Offline queue info */}
        {!isOnline && pendingCount > 0 && (
          <p style={s.queueNote}>
            {pendingCount} event{pendingCount !== 1 ? "s" : ""} saved locally — will sync when online.
          </p>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  offlineBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "#fffbeb",
    borderBottom: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 500,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#f59e0b",
    flexShrink: 0,
  },
  body: {
    padding: "16px 20px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap" as const,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
  },
  pendingBadge: {
    padding: "2px 8px",
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  syncingBadge: {
    padding: "2px 8px",
    background: "#ede9fe",
    color: "#5b21b6",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  syncedBadge: {
    padding: "2px 8px",
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  errorBadge: {
    padding: "2px 8px",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
  },
  btn: {
    flex: 1,
    minWidth: 120,
    padding: "14px 20px",
    borderRadius: 8,
    border: "none",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s",
    fontFamily: "inherit",
  },
  btnClockIn: {
    background: "#16a34a",
    color: "#fff",
  },
  btnClockOut: {
    background: "#dc2626",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  queueNote: {
    marginTop: 10,
    fontSize: 12,
    color: "#6b7280",
    margin: "10px 0 0",
  },
};
