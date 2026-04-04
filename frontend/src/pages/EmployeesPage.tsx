import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  Employee,
  CreateEmployeePayload,
} from "../api/employees";
import { useAuth } from "../contexts/AuthContext";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  hourlyRate: string;
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  position: "",
  hourlyRate: "",
};

export function EmployeesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryParams = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  } as { search?: string; status?: "active" | "inactive" };

  const { data: employees = [], isLoading, error } = useQuery({
    queryKey: ["employees", queryParams],
    queryFn: () => fetchEmployees(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployee(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      closeModal();
    },
    onError: () => setFormError("Failed to save employee. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateEmployeePayload }) =>
      updateEmployee(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      closeModal();
    },
    onError: () => setFormError("Failed to save employee. Please try again."),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setDeactivateTarget(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  function openCreate() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      position: emp.position ?? "",
      hourlyRate: emp.hourlyRate != null ? String(emp.hourlyRate) : "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEmployee(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function handleFormChange(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("First name and last name are required.");
      return;
    }
    const payload: CreateEmployeePayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      ...(form.email.trim() && { email: form.email.trim() }),
      ...(form.phone.trim() && { phone: form.phone.trim() }),
      ...(form.position.trim() && { position: form.position.trim() }),
      ...(form.hourlyRate.trim() && { hourlyRate: parseFloat(form.hourlyRate) }),
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Employees</h1>
          <p style={s.subtitle}>Manage your team members</p>
        </div>
        <button style={s.createBtn} onClick={openCreate}>
          + New Employee
        </button>
      </div>

      {/* Filters */}
      <div style={s.filtersBar}>
        <label style={s.filterLabel}>
          Search
          <input
            type="text"
            style={s.filterInput}
            placeholder="Name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <label style={s.filterLabel}>
          Status
          <select
            style={s.filterInput}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | "active" | "inactive")
            }
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        {(searchInput || statusFilter) && (
          <button
            style={s.clearBtn}
            onClick={() => {
              setSearchInput("");
              setStatusFilter("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading && <div style={s.state}>Loading employees...</div>}
      {error && (
        <div style={{ ...s.state, color: "#dc2626" }}>
          Failed to load employees.
        </div>
      )}

      {!isLoading && !error && employees.length === 0 && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>👥</div>
          <div style={s.emptyText}>No employees found</div>
          <div style={s.emptySubtext}>
            {debouncedSearch || statusFilter
              ? "Try adjusting your filters"
              : "Add your first employee to get started"}
          </div>
          {!debouncedSearch && !statusFilter && (
            <button style={s.createBtn} onClick={openCreate}>
              + New Employee
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && employees.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Name", "Email", "Phone", "Position", "Hourly Rate", "Status", "Actions"].map(
                  (h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.empName}>
                      {emp.firstName} {emp.lastName}
                    </div>
                  </td>
                  <td style={s.td}>{emp.email ?? <span style={s.empty2}>—</span>}</td>
                  <td style={s.td}>{emp.phone ?? <span style={s.empty2}>—</span>}</td>
                  <td style={s.td}>{emp.position ?? <span style={s.empty2}>—</span>}</td>
                  <td style={s.td}>
                    {emp.hourlyRate != null ? (
                      `$${emp.hourlyRate.toFixed(2)}/hr`
                    ) : (
                      <span style={s.empty2}>—</span>
                    )}
                  </td>
                  <td style={s.td}>
                    {emp.isActive ? (
                      <span style={s.badgeActive}>Active</span>
                    ) : (
                      <span style={s.badgeInactive}>Inactive</span>
                    )}
                  </td>
                  <td style={s.tdActions}>
                    <button style={s.editBtn} onClick={() => openEdit(emp)}>
                      Edit
                    </button>
                    {emp.isActive ? (
                      <button
                        style={s.deleteBtn}
                        onClick={() => setDeactivateTarget(emp)}
                      >
                        Deactivate
                      </button>
                    ) : user?.role === "ADMIN" ? (
                      <button
                        style={s.reactivateBtn}
                        disabled={reactivateMutation.isPending}
                        onClick={() => reactivateMutation.mutate(emp.id)}
                      >
                        Reactivate
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div style={s.backdrop} onClick={closeModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>
              {editingEmployee ? "Edit Employee" : "New Employee"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={s.formRow}>
                <label style={s.formLabel}>
                  First Name *
                  <input
                    style={s.formInput}
                    type="text"
                    value={form.firstName}
                    onChange={(e) => handleFormChange("firstName", e.target.value)}
                    required
                  />
                </label>
                <label style={s.formLabel}>
                  Last Name *
                  <input
                    style={s.formInput}
                    type="text"
                    value={form.lastName}
                    onChange={(e) => handleFormChange("lastName", e.target.value)}
                    required
                  />
                </label>
              </div>
              <label style={s.formLabel}>
                Email
                <input
                  style={s.formInput}
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                />
              </label>
              <label style={s.formLabel}>
                Phone
                <input
                  style={s.formInput}
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleFormChange("phone", e.target.value)}
                />
              </label>
              <label style={s.formLabel}>
                Position
                <input
                  style={s.formInput}
                  type="text"
                  value={form.position}
                  onChange={(e) => handleFormChange("position", e.target.value)}
                />
              </label>
              <label style={s.formLabel}>
                Hourly Rate ($)
                <input
                  style={s.formInput}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hourlyRate}
                  onChange={(e) => handleFormChange("hourlyRate", e.target.value)}
                />
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
                  {isSaving ? "Saving..." : editingEmployee ? "Save Changes" : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <div style={s.backdrop} onClick={() => setDeactivateTarget(null)}>
          <div style={s.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.confirmTitle}>Deactivate Employee</h3>
            <p style={s.confirmText}>
              Are you sure you want to deactivate{" "}
              <strong>
                {deactivateTarget.firstName} {deactivateTarget.lastName}
              </strong>
              ? They will no longer appear in active employee lists.
            </p>
            {deactivateMutation.error && (
              <p style={{ color: "#dc2626", fontSize: 13 }}>
                Failed to deactivate employee.
              </p>
            )}
            <div style={s.confirmActions}>
              <button
                style={s.cancelBtn}
                onClick={() => setDeactivateTarget(null)}
              >
                Cancel
              </button>
              <button
                style={s.confirmDeleteBtn}
                disabled={deactivateMutation.isPending}
                onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
              >
                {deactivateMutation.isPending ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
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
    minWidth: 160,
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
  empName: { fontWeight: 600, color: "#111827" },
  badgeActive: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#d1fae5",
    color: "#065f46",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  },
  badgeInactive: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#f3f4f6",
    color: "#6b7280",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  },
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
  reactivateBtn: {
    padding: "5px 12px",
    border: "1px solid #a7f3d0",
    borderRadius: 5,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#059669",
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
