import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSchedule } from "../api/schedules";
import { fetchShifts, deleteShift, Shift } from "../api/shifts";
import { Navbar } from "../components/Navbar";
import { ShiftFormModal } from "../components/shifts/ShiftFormModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#fef3c7", color: "#92400e" },
  PUBLISHED: { bg: "#d1fae5", color: "#065f46" },
  ARCHIVED: { bg: "#f3f4f6", color: "#6b7280" },
};

export function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  const {
    data: schedule,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useQuery({
    queryKey: ["schedule", id],
    queryFn: () => getSchedule(id!),
    enabled: !!id,
  });

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", { scheduleId: id }],
    queryFn: () => fetchShifts({ scheduleId: id! }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: (shiftId: string) => deleteShift(shiftId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setDeleteTarget(null);
      setDeleteError(false);
    },
    onError: () => {
      setDeleteError(true);
    },
  });

  function openCreate() {
    setEditingShift(null);
    setShiftModalOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditingShift(shift);
    setShiftModalOpen(true);
  }

  function closeShiftModal() {
    setShiftModalOpen(false);
    setEditingShift(null);
  }

  const isLoading = scheduleLoading || shiftsLoading;

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
        <button style={s.backBtn} onClick={() => navigate("/schedules")}>
          ← Schedules
        </button>

        {scheduleError && (
          <div style={{ color: "#dc2626", padding: "20px 0" }}>
            Failed to load schedule.
          </div>
        )}

        {schedule && (
          <>
            {/* Header */}
            <div style={s.header}>
              <div>
                <h1 style={s.pageTitle}>{schedule.name}</h1>
                <p style={s.subtitle}>
                  {formatDate(schedule.startDate)} –{" "}
                  {formatDate(schedule.endDate)}
                  <span
                    style={{
                      marginLeft: 10,
                      display: "inline-block",
                      padding: "2px 8px",
                      background:
                        statusColors[schedule.status]?.bg ?? "#f3f4f6",
                      color:
                        statusColors[schedule.status]?.color ?? "#6b7280",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      verticalAlign: "middle",
                    }}
                  >
                    {schedule.status}
                  </span>
                </p>
              </div>
              <button style={s.addBtn} onClick={openCreate}>
                + Add Shift
              </button>
            </div>

            {/* Loading */}
            {isLoading && (
              <div style={s.stateText}>Loading shifts...</div>
            )}

            {/* Empty state */}
            {!isLoading && shifts.length === 0 && (
              <div style={s.empty}>
                <div style={s.emptyIcon}>📅</div>
                <div style={s.emptyText}>No shifts yet</div>
                <div style={s.emptySubtext}>
                  Add your first shift to this schedule
                </div>
                <button style={s.addBtn} onClick={openCreate}>
                  + Add Shift
                </button>
              </div>
            )}

            {/* Shifts table */}
            {!isLoading && shifts.length > 0 && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {[
                        "Title",
                        "Employee(s)",
                        "Date",
                        "Time",
                        "Role",
                        "Actions",
                      ].map((h) => (
                        <th key={h} style={s.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => {
                      const assignedNames =
                        shift.assignments?.length > 0
                          ? shift.assignments
                              .map(
                                (a) =>
                                  `${a.employee.firstName} ${a.employee.lastName}`
                              )
                              .join(", ")
                          : shift.employee
                          ? `${shift.employee.firstName} ${shift.employee.lastName}`
                          : "—";

                      return (
                        <tr key={shift.id} style={s.tr}>
                          <td style={s.td}>
                            <div style={s.shiftTitle}>{shift.title}</div>
                            {shift.location && (
                              <div style={s.shiftMeta}>{shift.location}</div>
                            )}
                          </td>
                          <td style={s.td}>{assignedNames}</td>
                          <td style={s.td}>{formatDate(shift.startTime)}</td>
                          <td style={s.td}>
                            {formatTime(shift.startTime)} –{" "}
                            {formatTime(shift.endTime)}
                          </td>
                          <td style={s.td}>{shift.role ?? "—"}</td>
                          <td style={s.tdActions}>
                            <button
                              style={s.editBtn}
                              onClick={() => openEdit(shift)}
                            >
                              Edit
                            </button>
                            <button
                              style={s.deleteBtn}
                              onClick={() => setDeleteTarget(shift)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Shift create / edit modal */}
        {shiftModalOpen && (
          <ShiftFormModal
            shift={editingShift}
            defaultScheduleId={id}
            onClose={closeShiftModal}
          />
        )}

        {/* Delete confirmation */}
        {deleteTarget && (
          <div style={s.backdrop} onClick={() => { setDeleteTarget(null); setDeleteError(false); }}>
            <div
              style={s.confirmModal}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={s.confirmTitle}>Delete Shift</h3>
              <p style={s.confirmText}>
                Are you sure you want to delete{" "}
                <strong>"{deleteTarget.title}"</strong>? This action cannot
                be undone.
              </p>
              {deleteError && (
                <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
                  Failed to delete shift. Please try again.
                </p>
              )}
              <div style={s.confirmActions}>
                <button
                  style={s.cancelBtn}
                  onClick={() => { setDeleteTarget(null); setDeleteError(false); }}
                >
                  Cancel
                </button>
                <button
                  style={s.confirmDeleteBtn}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageWrapper: { minHeight: "100vh", background: "#f8fafc" },
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 24px 48px",
    fontFamily: "system-ui, sans-serif",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#4f46e5",
    fontSize: 14,
    cursor: "pointer",
    padding: "0 0 16px",
    fontWeight: 500,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    flexWrap: "wrap" as const,
    gap: 12,
  },
  pageTitle: {
    margin: "0 0 4px",
    fontSize: 26,
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: { margin: 0, color: "#6b7280", fontSize: 14 },
  addBtn: {
    padding: "9px 18px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  stateText: { textAlign: "center", padding: 40, color: "#6b7280" },
  empty: {
    textAlign: "center",
    padding: "60px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 18, fontWeight: 600, color: "#111827" },
  emptySubtext: { fontSize: 14, color: "#6b7280", marginBottom: 8 },
  tableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    minWidth: 600,
  },
  th: {
    padding: "10px 14px",
    background: "#f9fafb",
    color: "#374151",
    fontWeight: 600,
    fontSize: 12,
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    whiteSpace: "nowrap" as const,
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px 14px", color: "#374151", verticalAlign: "top" },
  tdActions: {
    padding: "10px 14px",
    whiteSpace: "nowrap" as const,
  },
  shiftTitle: { fontWeight: 600, color: "#111827" },
  shiftMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  editBtn: {
    marginRight: 6,
    padding: "5px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 5,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#374151",
  },
  deleteBtn: {
    padding: "5px 12px",
    border: "1px solid #fecaca",
    borderRadius: 5,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#dc2626",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 16,
  },
  confirmModal: {
    background: "#fff",
    borderRadius: 10,
    padding: 24,
    maxWidth: 400,
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  confirmTitle: { margin: "0 0 8px", fontSize: 17, fontWeight: 600 },
  confirmText: {
    color: "#374151",
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  confirmActions: { display: "flex", justifyContent: "flex-end", gap: 10 },
  cancelBtn: {
    padding: "8px 16px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
  },
  confirmDeleteBtn: {
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    background: "#dc2626",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
};
