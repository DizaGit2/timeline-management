export interface FilterState {
  employeeId?: string;
  role?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  role?: string;
}

interface Props {
  employees: Employee[];
  onFilterChange: (filter: FilterState) => void;
  activeFilter: FilterState;
}

export function ShiftFilter({ employees, onFilterChange, activeFilter }: Props) {
  // Derive unique roles from employee positions
  const roles = Array.from(
    new Set(
      employees
        .map((e) => e.position)
        .filter((p): p is string => !!p)
    )
  );

  function handleEmployeeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onFilterChange({
      ...activeFilter,
      employeeId: e.target.value || undefined,
    });
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onFilterChange({
      ...activeFilter,
      role: e.target.value || undefined,
    });
  }

  return (
    <div style={s.container}>
      <label style={s.label}>
        <span style={s.labelText}>Employee</span>
        <select
          aria-label="Employee"
          style={s.select}
          value={activeFilter.employeeId ?? ""}
          onChange={handleEmployeeChange}
        >
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>
      </label>

      <label style={s.label}>
        <span style={s.labelText}>Role</span>
        <select
          aria-label="Role"
          style={s.select}
          value={activeFilter.role ?? ""}
          onChange={handleRoleChange}
        >
          <option value="">All Roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
    alignItems: "flex-end",
    fontFamily: "system-ui, sans-serif",
  },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  labelText: {
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
  },
  select: {
    padding: "7px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    color: "#374151",
    background: "#fff",
    fontFamily: "inherit",
    cursor: "pointer",
  },
};
