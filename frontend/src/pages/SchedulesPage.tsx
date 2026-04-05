import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  Schedule,
  CreateSchedulePayload,
} from "../api/schedules";
import { Navbar } from "../components/Navbar";
import { useToast } from "../contexts/ToastContext";

interface FormState {
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

const emptyForm: FormState = {
  name: "",
  startDate: "",
  endDate: "",
  status: "DRAFT",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SchedulesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  const { data: schedules = [], isLoading, error } = useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateSchedulePayload) => createSchedule(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      addToast("Schedule created successfully.", "success");
      closeModal();
    },
    onError: () => {
      setFormError("Failed to save schedule. Please try again.");
      addToast("Failed to create schedule.", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateSchedulePayload }) =>
      updateSchedule(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      addToast("Schedule updated successfully.", "success");
      closeModal();
    },
    onError: () => {
      setFormError("Failed to save schedule. Please try again.");
      addToast("Failed to update schedule.", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      addToast("Schedule deleted.", "success");
      setDeleteTarget(null);
    },
    onError: () => {
      addToast("Failed to delete schedule.", "error");
    },
  });

  function openCreate() {
    setEditingSchedule(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(schedule: Schedule) {
    setEditingSchedule(schedule);
    setForm({
      name: schedule.name,
      startDate: schedule.startDate.slice(0, 10),
      endDate: schedule.endDate.slice(0, 10),
      status: schedule.status,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingSchedule(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function handleFormChange(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Schedule name is required.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setFormError("Start date and end date are required.");
      return;
    }
    if (form.startDate >= form.endDate) {
      setFormError("Start date must be before end date.");
      return;
    }

    const payload: CreateSchedulePayload = {
      name: form.name.trim(),
      startDate: new Date(form.startDate + "T00:00:00.000Z").toISOString(),
      endDate: new Date(form.endDate + "T23:59:59.999Z").toISOString(),
      status: form.status,
    };

    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const statusColors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "#fef3c7", color: "#92400e" },
    PUBLISHED: { bg: "#d1fae5", color: "#065f46" },
    ARCHIVED: { bg: "#f3f4f6", color: "#6b7280" },
  };

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Schedules</h1>
          <p style={s.subtitle}>Create and manage work schedules</p>
        </div>
        <button style={s.createBtn} onClick={openCreate}>
          + New Schedule
        </button>
      </div>

      {/* Content */}
      {isLoading && <div style={s.state}>Loading schedules...</div>}
      {error && (
        <div style={{ ...s.state, color: "#dc2626" }}>
          Failed to load schedules.
        </div>
      )}

      {!isLoading && !error && schedules.length === 0 && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📋</div>
          <div style={s.emptyText}>No schedules yet</div>
          <div style={s.emptySubtext}>
            Create a schedule to start adding shifts
          </div>
          <button style={s.createBtn} onClick={openCreate}>
            + New Schedule
          </button>
        </div>
      )}

      {!isLoading && !error && schedules.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Name", "Start Date", "End Date", "Status", "Actions"].map(
                  (h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => {
                const sc = statusColors[schedule.status] ?? statusColors.DRAFT;
                return (
                  <tr key={schedule.id} style={s.tr}>
                    <td style={s.td}>
                      <div style={s.scheduleName}>{schedule.name}</div>
                    </td>
                    <td style={s.td}>{formatDate(schedule.startDate)}</td>
                    <td style={s.td}>{formatDate(schedule.endDate)}</td>
                    <td style={s.td}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          background: sc.bg,
                          color: sc.color,
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {schedule.status}
                      </span>
                    </td>
                    <td style={s.tdActions}>
                      <button
                        style={s.editBtn}
                        onClick={() => openEdit(schedule)}
                      >
                        Edit
                      </button>
                      <button
                        style={s.deleteBtn}
                        onClick={() => setDeleteTarget(schedule)}
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div style={s.backdrop} onClick={closeModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>
              {editingSchedule ? "Edit Schedule" : "New Schedule"}
            </h3>
            <form onSubmit={handleSubmit}>
              <label style={s.formLabel}>
                Name *
                <input
                  style={s.formInput}
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  required
                />
              </label>
              <div style={s.formRow}>
                <label style={s.formLabel}>
                  Start Date *
                  <input
                    style={s.formInput}
                    type="date"
                    value={form.startDate}
                    onChange={(e) => handleFormChange("startDate", e.target.value)}
                    required
                  />
                </label>
                <label style={s.formLabel}>
                  End Date *
                  <input
                    style={s.formInput}
                    type="date"
                    value={form.endDate}
                    onChange={(e) => handleFormChange("endDate", e.target.value)}
                    required
                  />
                </label>
              </div>
              <label style={s.formLabel}>
                Status
                <select
                  style={s.formInput}
                  value={form.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              {formError && (
                <p style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>
                  {formError}
                </p>
              )}
              <div style={s.modalActions}>
                <button
                  type="button"
                  style={s.cancelBtn}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={s.saveBtn}
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingSchedule
                    ? "Save Changes"
                    : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={s.backdrop} onClick={() => setDeleteTarget(null)}>
          <div style={s.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.confirmTitle}>Delete Schedule</h3>
            <p style={s.confirmText}>
              Are you sure you want to delete{" "}
              <strong>"{deleteTarget.name}"</strong>? All shifts within this
              schedule will also be deleted. This action cannot be undone.
            </p>
            {deleteMutation.error && (
              <p style={{ color: "#dc2626", fontSize: 13 }}>
                Failed to delete schedule.
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
  scheduleName: { fontWeight: 600, color: "#111827" },
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
  modal: {
    background: "#fff",
    borderRadius: 10,
    padding: 28,
    maxWidth: 500,
    width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalTitle: { margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#111827" },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  formLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 12,
  },
  formInput: {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    color: "#111827",
    fontFamily: "inherit",
    background: "#fff",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    padding: "8px 16px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
  },
  saveBtn: {
    padding: "8px 18px",
    border: "none",
    borderRadius: 6,
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
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
