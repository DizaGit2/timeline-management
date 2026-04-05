import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchShifts,
  deleteShift,
  fetchEmployees,
  fetchSchedules,
  Shift,
  ShiftFilters,
} from "../api/shifts";
import { ShiftFormModal } from "../components/shifts/ShiftFormModal";
import { Navbar } from "../components/Navbar";
import { useToast } from "../contexts/ToastContext";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ShiftsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const [filters, setFilters] = useState<ShiftFilters>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: ["shifts", filters],
    queryFn: () => fetchShifts(filters),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteShift(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      addToast("Shift deleted.", "success");
      setDeleteTarget(null);
    },
    onError: () => {
      addToast("Failed to delete shift.", "error");
    },
  });

  function openCreate() {
    setEditingShift(null);
    setModalOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditingShift(shift);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingShift(null);
  }

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Shifts</h1>
          <p style={s.subtitle}>Manage shift assignments and scheduling</p>
        </div>
        <button style={s.createBtn} onClick={openCreate}>
          + New Shift
        </button>
      </div>

      {/* Filters */}
      <div style={s.filtersBar}>
        <label style={s.filterLabel}>
          From
          <input
            type="date"
            style={s.filterInput}
            value={filters.from ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value || undefined }))
            }
          />
        </label>
        <label style={s.filterLabel}>
          To
          <input
            type="date"
            style={s.filterInput}
            value={filters.to ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, to: e.target.value || undefined }))
            }
          />
        </label>
        <label style={s.filterLabel}>
          Employee
          <select
            style={s.filterInput}
            value={filters.employeeId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                employeeId: e.target.value || undefined,
              }))
            }
          >
            <option value="">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </label>
        <label style={s.filterLabel}>
          Schedule
          <select
            style={s.filterInput}
            value={filters.scheduleId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                scheduleId: e.target.value || undefined,
              }))
            }
          >
            <option value="">All schedules</option>
            {schedules.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </label>
        {(filters.from || filters.to || filters.employeeId || filters.scheduleId) && (
          <button
            style={s.clearBtn}
            onClick={() => setFilters({})}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading && <div style={s.state}>Loading shifts...</div>}
      {error && (
        <div style={{ ...s.state, color: "#dc2626" }}>
          Failed to load shifts.
        </div>
      )}

      {!isLoading && !error && shifts.length === 0 && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📅</div>
          <div style={s.emptyText}>No shifts found</div>
          <div style={s.emptySubtext}>
            Create your first shift to get started
          </div>
          <button style={s.createBtn} onClick={openCreate}>
            + New Shift
          </button>
        </div>
      )}

      {!isLoading && shifts.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Title", "Date", "Time", "Role", "Schedule", "Assigned", "Actions"].map(
                  (h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.shiftTitle}>{shift.title}</div>
                    {shift.location && (
                      <div style={s.shiftMeta}>📍 {shift.location}</div>
                    )}
                  </td>
                  <td style={s.td}>{formatDate(shift.startTime)}</td>
                  <td style={s.td}>
                    {formatDateTime(shift.startTime)} –{" "}
                    {formatDateTime(shift.endTime)}
                  </td>
                  <td style={s.td}>
                    {shift.role ? (
                      <span style={s.badge}>{shift.role}</span>
                    ) : (
                      <span style={s.empty2}>—</span>
                    )}
                  </td>
                  <td style={s.td}>{shift.schedule.name}</td>
                  <td style={s.td}>
                    {shift.assignments && shift.assignments.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {shift.assignments.map((a) => (
                          <span key={a.employeeId} style={s.assigned}>
                            {a.employee.firstName} {a.employee.lastName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={s.unassigned}>Unassigned</span>
                    )}
                  </td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {modalOpen && (
        <ShiftFormModal shift={editingShift} onClose={closeModal} />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div style={s.backdrop} onClick={() => setDeleteTarget(null)}>
          <div style={s.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.confirmTitle}>Delete Shift</h3>
            <p style={s.confirmText}>
              Are you sure you want to delete{" "}
              <strong>"{deleteTarget.title}"</strong>? This action cannot be
              undone.
            </p>
            {deleteMutation.error && (
              <p style={{ color: "#dc2626", fontSize: 13 }}>
                Failed to delete shift.
              </p>
            )}
            <div style={s.confirmActions}>
              <button
                style={s.cancelBtn}
                onClick={() => setDeleteTarget(null)}
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
    padding: "32px 24px",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  pageTitle: {
    margin: "0 0 4px",
    fontSize: 26,
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: { margin: 0, color: "#6b7280", fontSize: 14 },
  createBtn: {
    padding: "9px 18px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  filtersBar: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 20,
    padding: "14px 16px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
  },
  filterInput: {
    padding: "6px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    background: "#fff",
    color: "#111827",
    fontFamily: "inherit",
  },
  clearBtn: {
    padding: "6px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#6b7280",
    alignSelf: "flex-end",
  },
  state: { textAlign: "center", padding: 40, color: "#6b7280" },
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
    overflow: "hidden",
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
  td: { padding: "12px 14px", color: "#374151", verticalAlign: "top" },
  tdActions: { padding: "10px 14px", whiteSpace: "nowrap" as const },
  shiftTitle: { fontWeight: 600, color: "#111827" },
  shiftMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  },
  assigned: { color: "#059669", fontWeight: 500 },
  unassigned: { color: "#d97706", fontSize: 12, fontStyle: "italic" },
  empty2: { color: "#9ca3af" },
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
  confirmText: { color: "#374151", fontSize: 14, marginBottom: 20, lineHeight: 1.5 },
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
