import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createShift,
  updateShift,
  assignEmployees,
  removeAssignment,
  fetchEmployees,
  fetchSchedules,
  fetchShiftConflicts,
  Shift,
  ShiftConflict,
  CreateShiftPayload,
  UpdateShiftPayload,
} from "../../api/shifts";
import { ConflictWarning } from "./ConflictWarning";
import { useToast } from "../../contexts/ToastContext";

interface Props {
  shift?: Shift | null;
  onClose: () => void;
}

interface FormValues {
  scheduleId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  role: string;
  requiredHeadcount: number;
  notes: string;
}

function toISOString(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
}

export function ShiftFormModal({ shift, onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const isEdit = !!shift;

  // For new shifts, track which employee IDs to assign after creation
  // For edit shifts, show current assignments and allow toggling
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(shift?.assignments?.map((a) => a.employeeId) ?? [])
  );
  const [empSearch, setEmpSearch] = useState("");
  const [conflicts, setConflicts] = useState<ShiftConflict[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      scheduleId: shift?.scheduleId ?? "",
      title: shift?.title ?? "",
      date: shift ? formatDate(shift.startTime) : "",
      startTime: shift ? formatTime(shift.startTime) : "",
      endTime: shift ? formatTime(shift.endTime) : "",
      location: shift?.location ?? "",
      role: shift?.role ?? "",
      requiredHeadcount: shift?.requiredHeadcount ?? 1,
      notes: shift?.notes ?? "",
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployees,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: fetchSchedules,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateShiftPayload & { assignIds: string[] }) => {
      const { assignIds, ...rest } = payload;
      const created = await createShift(rest);
      if (assignIds.length > 0) {
        return assignEmployees(created.id, assignIds);
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      addToast("Shift created successfully.", "success");
      onClose();
    },
    onError: () => {
      addToast("Failed to create shift.", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateShiftPayload) => {
      return updateShift(shift!.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      addToast("Shift updated successfully.", "success");
      onClose();
    },
    onError: () => {
      addToast("Failed to update shift.", "error");
    },
  });

  const mutationError =
    createMutation.error || updateMutation.error
      ? "Failed to save shift. Please try again."
      : null;

  async function handleEmployeeToggle(empId: string) {
    const next = new Set(selectedIds);
    if (next.has(empId)) {
      next.delete(empId);
      // For edit mode, immediately remove from server
      if (isEdit) {
        try {
          await removeAssignment(shift!.id, empId);
          qc.invalidateQueries({ queryKey: ["shifts"] });
        } catch {
          // revert
          next.add(empId);
        }
      }
    } else {
      next.add(empId);
      // For edit mode, immediately assign
      if (isEdit) {
        try {
          await assignEmployees(shift!.id, [empId]);
          qc.invalidateQueries({ queryKey: ["shifts"] });
          // Check conflicts
          const c = await fetchShiftConflicts(shift!.id, empId);
          setConflicts((prev) => [...prev.filter((x) => x.shiftId !== empId), ...c]);
        } catch {
          next.delete(empId);
        }
      }
    }
    setSelectedIds(next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(values: FormValues) {
    if (isEdit) {
      const payload: UpdateShiftPayload = {
        title: values.title,
        startTime: toISOString(values.date, values.startTime),
        endTime: toISOString(values.date, values.endTime),
        location: values.location || undefined,
        role: values.role || undefined,
        requiredHeadcount: values.requiredHeadcount,
        notes: values.notes || undefined,
      };
      await updateMutation.mutateAsync(payload);
    } else {
      const payload = {
        scheduleId: values.scheduleId,
        title: values.title,
        startTime: toISOString(values.date, values.startTime),
        endTime: toISOString(values.date, values.endTime),
        location: values.location || undefined,
        role: values.role || undefined,
        requiredHeadcount: values.requiredHeadcount,
        notes: values.notes || undefined,
        assignIds: Array.from(selectedIds),
      };
      await createMutation.mutateAsync(payload);
    }
  }

  const filteredEmployees = employees.filter((e) => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    return name.includes(empSearch.toLowerCase());
  });

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>{isEdit ? "Edit Shift" : "New Shift"}</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={s.form}>
          {/* Schedule (only for create) */}
          {!isEdit && (
            <label style={s.label}>
              Schedule *
              <select
                style={{ ...s.input, ...(errors.scheduleId ? s.inputError : {}) }}
                {...register("scheduleId", { required: "Schedule is required" })}
              >
                <option value="">— select —</option>
                {schedules.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              {errors.scheduleId && (
                <span style={s.fieldError}>{errors.scheduleId.message}</span>
              )}
            </label>
          )}

          {/* Title */}
          <label style={s.label}>
            Title *
            <input
              style={{ ...s.input, ...(errors.title ? s.inputError : {}) }}
              placeholder="Morning shift, Opening, ..."
              {...register("title", { required: "Title is required" })}
            />
            {errors.title && (
              <span style={s.fieldError}>{errors.title.message}</span>
            )}
          </label>

          {/* Date */}
          <label style={s.label}>
            Date *
            <input
              type="date"
              style={{ ...s.input, ...(errors.date ? s.inputError : {}) }}
              {...register("date", { required: "Date is required" })}
            />
            {errors.date && (
              <span style={s.fieldError}>{errors.date.message}</span>
            )}
          </label>

          {/* Time row */}
          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>
              Start Time *
              <input
                type="time"
                style={{ ...s.input, ...(errors.startTime ? s.inputError : {}) }}
                {...register("startTime", { required: "Required" })}
              />
              {errors.startTime && (
                <span style={s.fieldError}>{errors.startTime.message}</span>
              )}
            </label>
            <label style={{ ...s.label, flex: 1 }}>
              End Time *
              <input
                type="time"
                style={{ ...s.input, ...(errors.endTime ? s.inputError : {}) }}
                {...register("endTime", { required: "Required" })}
              />
              {errors.endTime && (
                <span style={s.fieldError}>{errors.endTime.message}</span>
              )}
            </label>
          </div>

          {/* Location */}
          <label style={s.label}>
            Location
            <input
              style={s.input}
              placeholder="Main floor, Register 3, ..."
              {...register("location")}
            />
          </label>

          {/* Role + Headcount */}
          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>
              Role
              <input
                style={s.input}
                placeholder="Cashier, Supervisor, ..."
                {...register("role")}
              />
            </label>
            <label style={{ ...s.label, width: 120 }}>
              Headcount
              <input
                type="number"
                min={1}
                style={s.input}
                {...register("requiredHeadcount", {
                  valueAsNumber: true,
                  min: 1,
                })}
              />
            </label>
          </div>

          {/* Notes */}
          <label style={s.label}>
            Notes
            <textarea
              style={{ ...s.input, minHeight: 60, resize: "vertical" }}
              {...register("notes")}
            />
          </label>

          {/* Employee picker */}
          <div style={s.section}>
            <div style={s.sectionTitle}>
              Assign Employees
              {selectedIds.size > 0 && (
                <span style={s.badge}>{selectedIds.size} selected</span>
              )}
            </div>
            <input
              style={{ ...s.input, marginBottom: 8 }}
              placeholder="Search employees..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
            />
            <div style={s.empList}>
              {filteredEmployees.length === 0 && (
                <div style={s.emptyMsg}>No employees found</div>
              )}
              {filteredEmployees.map((emp) => {
                const selected = selectedIds.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    style={{ ...s.empItem, ...(selected ? s.empItemSelected : {}) }}
                    onClick={() => void handleEmployeeToggle(emp.id)}
                  >
                    <span style={s.empName}>
                      {emp.firstName} {emp.lastName}
                    </span>
                    {emp.position && (
                      <span style={s.empPos}>{emp.position}</span>
                    )}
                    {selected && <span style={s.empCheck}>✓</span>}
                  </button>
                );
              })}
            </div>
            <ConflictWarning conflicts={conflicts} />
          </div>

          {mutationError && <div style={s.apiError}>{mutationError}</div>}

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={s.submitBtn} disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEdit
                ? "Save Changes"
                : "Create Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 10,
    width: "100%",
    maxWidth: 560,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: "#111827" },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    color: "#6b7280",
    lineHeight: 1,
    padding: "0 4px",
  },
  form: {
    padding: "16px 20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    color: "#111827",
    background: "#fff",
  },
  inputError: { borderColor: "#ef4444" },
  fieldError: { color: "#ef4444", fontSize: 12, fontWeight: 400 },
  row: { display: "flex", gap: 12 },
  section: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: 20,
    padding: "1px 8px",
    fontSize: 11,
    fontWeight: 600,
  },
  empList: {
    maxHeight: 180,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  empItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#f9fafb",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
    color: "#374151",
  },
  empItemSelected: {
    borderColor: "#6366f1",
    background: "#eef2ff",
    color: "#4338ca",
  },
  empName: { flex: 1, fontWeight: 500 },
  empPos: { fontSize: 12, color: "#9ca3af" },
  empCheck: { color: "#4338ca", fontWeight: 700 },
  emptyMsg: { color: "#9ca3af", fontSize: 13, padding: "8px 0" },
  apiError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
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
  submitBtn: {
    padding: "8px 20px",
    border: "none",
    borderRadius: 6,
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
};
