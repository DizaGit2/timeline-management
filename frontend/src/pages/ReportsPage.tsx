import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchHoursReport,
  fetchUnfilledReport,
  downloadScheduleCsv,
  HoursRow,
  UnfilledShift,
} from "../api/reports";

type Tab = "hours" | "unfilled";

function getThisMonday(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("hours");
  const [weekStart, setWeekStart] = useState<string>(getThisMonday);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const {
    data: hoursData = [],
    isLoading: loadingHours,
    error: hoursError,
  } = useQuery<HoursRow[]>({
    queryKey: ["report-hours", weekStart],
    queryFn: () => fetchHoursReport(weekStart),
    enabled: tab === "hours" && !!weekStart,
  });

  const {
    data: unfilledData = [],
    isLoading: loadingUnfilled,
    error: unfilledError,
  } = useQuery<UnfilledShift[]>({
    queryKey: ["report-unfilled", weekStart],
    queryFn: () => fetchUnfilledReport(weekStart),
    enabled: tab === "unfilled" && !!weekStart,
  });

  async function handleDownloadCsv() {
    setCsvLoading(true);
    setCsvError(null);
    try {
      await downloadScheduleCsv(weekStart);
    } catch {
      setCsvError("Failed to download CSV. Please try again.");
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Reports</h1>
          <p style={s.subtitle}>Analytics and schedule exports</p>
        </div>
        <div style={s.headerActions}>
          <button
            style={s.csvBtn}
            onClick={handleDownloadCsv}
            disabled={!weekStart || csvLoading}
          >
            {csvLoading ? "Downloading..." : "Download CSV"}
          </button>
        </div>
      </div>

      {csvError && (
        <div style={s.errorBanner}>{csvError}</div>
      )}

      {/* Week picker */}
      <div style={s.filtersBar}>
        <label style={s.filterLabel}>
          Week starting
          <input
            type="date"
            style={s.filterInput}
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
        </label>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        <button
          style={tab === "hours" ? s.tabActive : s.tabInactive}
          onClick={() => setTab("hours")}
        >
          Hours by Employee
        </button>
        <button
          style={tab === "unfilled" ? s.tabActive : s.tabInactive}
          onClick={() => setTab("unfilled")}
        >
          Unfilled Shifts
        </button>
      </div>

      {/* Hours Report */}
      {tab === "hours" && (
        <>
          {loadingHours && <div style={s.stateMsg}>Loading hours report...</div>}
          {hoursError && (
            <div style={{ ...s.stateMsg, color: "#dc2626" }}>
              Failed to load hours report.
            </div>
          )}
          {!loadingHours && !hoursError && hoursData.length === 0 && (
            <div style={s.empty}>No hours data for this week.</div>
          )}
          {!loadingHours && !hoursError && hoursData.length > 0 && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Employee Name", "Shifts", "Total Hours"].map((h) => (
                      <th key={h} style={s.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hoursData.map((row) => (
                    <tr key={row.employeeId} style={s.tr}>
                      <td style={s.td}>
                        <span style={s.empName}>{row.employeeName}</span>
                      </td>
                      <td style={s.td}>{row.shiftCount}</td>
                      <td style={s.td}>
                        <span style={s.hoursValue}>{row.totalHours.toFixed(1)} hrs</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={s.footTd}>Total</td>
                    <td style={s.footTd}>
                      {hoursData.reduce((sum, r) => sum + r.shiftCount, 0)}
                    </td>
                    <td style={s.footTd}>
                      {hoursData.reduce((sum, r) => sum + r.totalHours, 0).toFixed(1)} hrs
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* Unfilled Shifts Report */}
      {tab === "unfilled" && (
        <>
          {loadingUnfilled && <div style={s.stateMsg}>Loading unfilled shifts...</div>}
          {unfilledError && (
            <div style={{ ...s.stateMsg, color: "#dc2626" }}>
              Failed to load unfilled shifts.
            </div>
          )}
          {!loadingUnfilled && !unfilledError && unfilledData.length === 0 && (
            <div style={s.empty}>No unfilled shifts for this week.</div>
          )}
          {!loadingUnfilled && !unfilledError && unfilledData.length > 0 && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Date", "Shift Title", "Required", "Assigned", "Gap"].map((h) => (
                      <th key={h} style={s.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unfilledData.map((row) => {
                    const gap = row.required - row.assigned;
                    return (
                      <tr key={row.shiftId} style={s.tr}>
                        <td style={s.td}>{row.date}</td>
                        <td style={s.td}>
                          <span style={s.empName}>{row.title}</span>
                        </td>
                        <td style={s.td}>{row.required}</td>
                        <td style={s.td}>{row.assigned}</td>
                        <td style={s.td}>
                          <span style={gap > 0 ? s.gapBadge : s.okBadge}>
                            {gap > 0 ? `-${gap}` : "Full"}
                          </span>
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
  headerActions: { display: "flex", gap: 10 },
  csvBtn: {
    padding: "9px 18px",
    background: "#059669",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
  },
  filtersBar: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
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
  tabBar: {
    display: "flex",
    gap: 0,
    borderBottom: "2px solid #e5e7eb",
    marginBottom: 20,
  },
  tabActive: {
    padding: "10px 20px",
    background: "none",
    border: "none",
    borderBottom: "2px solid #4f46e5",
    marginBottom: -2,
    fontSize: 14,
    fontWeight: 600,
    color: "#4f46e5",
    cursor: "pointer",
  },
  tabInactive: {
    padding: "10px 20px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
    fontSize: 14,
    fontWeight: 500,
    color: "#6b7280",
    cursor: "pointer",
  },
  stateMsg: { textAlign: "center", padding: 40, color: "#6b7280", fontSize: 14 },
  empty: {
    textAlign: "center",
    padding: 40,
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
  },
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
  td: { padding: "12px 14px", color: "#374151" },
  footTd: {
    padding: "10px 14px",
    color: "#111827",
    fontWeight: 600,
    fontSize: 13,
    borderTop: "2px solid #e5e7eb",
    background: "#f9fafb",
  },
  empName: { fontWeight: 600, color: "#111827" },
  hoursValue: { fontWeight: 600, color: "#4f46e5" },
  gapBadge: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  okBadge: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#d1fae5",
    color: "#059669",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
};
