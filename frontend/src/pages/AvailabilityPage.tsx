import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAvailability,
  replaceAvailability,
  listUnavailability,
  createUnavailability,
  deleteUnavailability,
  AvailabilityWindow,
} from "../api/availability";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface NewWindowForm {
  startTime: string;
  endTime: string;
}

export function AvailabilityPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const qc = useQueryClient();

  const id = employeeId ?? "";

  // Availability windows state
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newWindow, setNewWindow] = useState<NewWindowForm>({ startTime: "09:00", endTime: "17:00" });
  const [windowError, setWindowError] = useState<string | null>(null);

  // Unavailability exceptions state
  const [newExcDate, setNewExcDate] = useState("");
  const [newExcReason, setNewExcReason] = useState("");
  const [excError, setExcError] = useState<string | null>(null);

  const { data: windows = [], isLoading: loadingWindows } = useQuery({
    queryKey: ["availability", id],
    queryFn: () => getAvailability(id),
    enabled: !!id,
  });

  const { data: exceptions = [], isLoading: loadingExceptions } = useQuery({
    queryKey: ["unavailability", id],
    queryFn: () => listUnavailability(id),
    enabled: !!id,
  });

  const replaceAvailMutation = useMutation({
    mutationFn: (wins: Array<{ dayOfWeek: number; startTime: string; endTime: string; type?: string }>) =>
      replaceAvailability(id, wins),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability", id] });
      setAddingDay(null);
      setWindowError(null);
    },
    onError: () => setWindowError("Failed to save availability. Please try again."),
  });

  const addExceptionMutation = useMutation({
    mutationFn: (payload: { date: string; reason?: string }) =>
      createUnavailability(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unavailability", id] });
      setNewExcDate("");
      setNewExcReason("");
      setExcError(null);
    },
    onError: () => setExcError("Failed to add exception. Please try again."),
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (exceptionId: string) => deleteUnavailability(id, exceptionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unavailability", id] });
    },
  });

  function handleAddWindow(e: React.FormEvent) {
    e.preventDefault();
    if (!newWindow.startTime || !newWindow.endTime) {
      setWindowError("Start and end times are required.");
      return;
    }
    if (newWindow.startTime >= newWindow.endTime) {
      setWindowError("End time must be after start time.");
      return;
    }
    if (addingDay === null) return;

    const updatedWindows: Array<{ dayOfWeek: number; startTime: string; endTime: string; type: string }> = [
      ...windows.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        type: w.type || "AVAILABLE",
      })),
      { dayOfWeek: addingDay, startTime: newWindow.startTime, endTime: newWindow.endTime, type: "AVAILABLE" },
    ];

    replaceAvailMutation.mutate(updatedWindows);
  }

  function handleDeleteWindow(win: AvailabilityWindow) {
    const updatedWindows = windows
      .filter((w) => w.id !== win.id)
      .map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        type: w.type || "AVAILABLE",
      }));
    replaceAvailMutation.mutate(updatedWindows);
  }

  function handleAddException(e: React.FormEvent) {
    e.preventDefault();
    if (!newExcDate) {
      setExcError("Date is required.");
      return;
    }
    addExceptionMutation.mutate({
      date: newExcDate,
      ...(newExcReason.trim() && { reason: newExcReason.trim() }),
    });
  }

  if (!id) {
    return (
      <div style={s.page}>
        <p style={{ color: "#dc2626" }}>No employee ID provided.</p>
      </div>
    );
  }

  // Group windows by day
  const windowsByDay: Record<number, AvailabilityWindow[]> = {};
  for (let d = 0; d < 7; d++) windowsByDay[d] = [];
  for (const w of windows) {
    windowsByDay[w.dayOfWeek] = [...(windowsByDay[w.dayOfWeek] || []), w];
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Availability</h1>
          <p style={s.subtitle}>Manage recurring availability and time-off exceptions</p>
        </div>
      </div>

      {/* Weekly Availability Grid */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Weekly Availability</h2>
        {loadingWindows && <div style={s.stateMsg}>Loading availability...</div>}
        {!loadingWindows && (
          <div style={s.dayGrid}>
            {DAY_NAMES.map((dayName, dayIdx) => (
              <div key={dayIdx} style={s.dayRow}>
                <div style={s.dayName}>{dayName}</div>
                <div style={s.windowList}>
                  {windowsByDay[dayIdx].length === 0 ? (
                    <span style={s.noWindows}>No windows set</span>
                  ) : (
                    windowsByDay[dayIdx].map((win) => (
                      <div key={win.id} style={s.windowItem}>
                        <span style={s.windowTime}>
                          {win.startTime} – {win.endTime}
                        </span>
                        <button
                          style={s.removeBtn}
                          onClick={() => handleDeleteWindow(win)}
                          disabled={replaceAvailMutation.isPending}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {addingDay === dayIdx ? (
                  <form onSubmit={handleAddWindow} style={s.addWindowForm}>
                    <input
                      type="time"
                      style={s.timeInput}
                      value={newWindow.startTime}
                      onChange={(e) =>
                        setNewWindow((w) => ({ ...w, startTime: e.target.value }))
                      }
                    />
                    <span style={{ color: "#6b7280", fontSize: 13 }}>to</span>
                    <input
                      type="time"
                      style={s.timeInput}
                      value={newWindow.endTime}
                      onChange={(e) =>
                        setNewWindow((w) => ({ ...w, endTime: e.target.value }))
                      }
                    />
                    <button
                      type="submit"
                      style={s.saveWindowBtn}
                      disabled={replaceAvailMutation.isPending}
                    >
                      {replaceAvailMutation.isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      style={s.cancelSmBtn}
                      onClick={() => {
                        setAddingDay(null);
                        setWindowError(null);
                      }}
                    >
                      Cancel
                    </button>
                    {windowError && (
                      <span style={{ color: "#dc2626", fontSize: 12 }}>{windowError}</span>
                    )}
                  </form>
                ) : (
                  <button
                    style={s.addWindowBtn}
                    onClick={() => {
                      setAddingDay(dayIdx);
                      setNewWindow({ startTime: "09:00", endTime: "17:00" });
                      setWindowError(null);
                    }}
                  >
                    + Add window
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Unavailability Exceptions */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Time-Off Exceptions</h2>
        <p style={s.sectionSubtitle}>One-off dates when you are unavailable</p>

        {loadingExceptions && <div style={s.stateMsg}>Loading exceptions...</div>}

        {!loadingExceptions && exceptions.length === 0 && (
          <div style={s.noExceptions}>No exceptions added yet.</div>
        )}

        {!loadingExceptions && exceptions.length > 0 && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Date", "Reason", "Actions"].map((h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exceptions.map((exc) => (
                  <tr key={exc.id} style={s.tr}>
                    <td style={s.td}>{exc.date}</td>
                    <td style={s.td}>{exc.reason ?? <span style={s.noReason}>—</span>}</td>
                    <td style={s.tdActions}>
                      <button
                        style={s.deleteExcBtn}
                        disabled={deleteExceptionMutation.isPending}
                        onClick={() => deleteExceptionMutation.mutate(exc.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add exception form */}
        <form onSubmit={handleAddException} style={s.addExcForm}>
          <h3 style={s.addExcTitle}>Add Exception</h3>
          <div style={s.addExcRow}>
            <label style={s.formLabel}>
              Date *
              <input
                type="date"
                style={s.formInput}
                value={newExcDate}
                onChange={(e) => setNewExcDate(e.target.value)}
                required
              />
            </label>
            <label style={s.formLabel}>
              Reason (optional)
              <input
                type="text"
                style={s.formInput}
                placeholder="e.g. Doctor appointment"
                value={newExcReason}
                onChange={(e) => setNewExcReason(e.target.value)}
              />
            </label>
            <button
              type="submit"
              style={{ ...s.saveWindowBtn, alignSelf: "flex-end" }}
              disabled={addExceptionMutation.isPending}
            >
              {addExceptionMutation.isPending ? "Adding..." : "Add Exception"}
            </button>
          </div>
          {excError && (
            <p style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>{excError}</p>
          )}
        </form>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    marginBottom: 28,
  },
  pageTitle: {
    margin: "0 0 4px",
    fontSize: 26,
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: { margin: 0, color: "#6b7280", fontSize: 14 },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 4px",
  },
  sectionSubtitle: {
    color: "#6b7280",
    fontSize: 14,
    margin: "0 0 16px",
  },
  stateMsg: {
    color: "#6b7280",
    padding: "16px 0",
    fontSize: 14,
  },
  dayGrid: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  dayRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    padding: "12px 16px",
    borderBottom: "1px solid #f3f4f6",
    flexWrap: "wrap" as const,
  },
  dayName: {
    width: 100,
    fontWeight: 600,
    fontSize: 14,
    color: "#374151",
    paddingTop: 4,
    flexShrink: 0,
  },
  windowList: {
    flex: 1,
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    alignItems: "center",
  },
  windowItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    borderRadius: 6,
    padding: "4px 10px",
  },
  windowTime: {
    fontSize: 13,
    color: "#4338ca",
    fontWeight: 500,
  },
  noWindows: {
    fontSize: 13,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  removeBtn: {
    fontSize: 12,
    color: "#dc2626",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 2px",
    textDecoration: "underline",
  },
  addWindowForm: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  timeInput: {
    padding: "5px 8px",
    border: "1px solid #d1d5db",
    borderRadius: 5,
    fontSize: 13,
    fontFamily: "inherit",
    color: "#111827",
    background: "#fff",
  },
  saveWindowBtn: {
    padding: "6px 14px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  cancelSmBtn: {
    padding: "6px 12px",
    background: "#fff",
    color: "#6b7280",
    border: "1px solid #d1d5db",
    borderRadius: 5,
    fontSize: 13,
    cursor: "pointer",
  },
  addWindowBtn: {
    padding: "4px 12px",
    background: "#fff",
    color: "#4f46e5",
    border: "1px solid #c7d2fe",
    borderRadius: 5,
    fontSize: 13,
    cursor: "pointer",
    flexShrink: 0,
  },
  tableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 20,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    padding: "10px 14px",
    background: "#f9fafb",
    color: "#374151",
    fontWeight: 600,
    fontSize: 12,
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px 14px", color: "#374151" },
  tdActions: { padding: "10px 14px" },
  noReason: { color: "#9ca3af" },
  noExceptions: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 20,
  },
  deleteExcBtn: {
    padding: "5px 12px",
    border: "1px solid #fecaca",
    borderRadius: 5,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#dc2626",
  },
  addExcForm: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "16px 20px",
  },
  addExcTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 600,
    color: "#111827",
  },
  addExcRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap" as const,
  },
  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  formInput: {
    padding: "7px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    color: "#111827",
    fontFamily: "inherit",
    background: "#fff",
    minWidth: 160,
  },
};
