/**
 * ManagerSwapRequestsPage — TIM-197
 *
 * Manager view: Pending Swaps Queue (Pending + Resolved tabs).
 * UX spec Screen 4.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSwapRequests,
  resolveSwapRequest,
  SwapRequest,
  SwapStatus,
} from "../api/swapRequests";
import { Navbar } from "../components/Navbar";

const MANAGER_REJECT_REASONS = [
  "Operational requirements",
  "Insufficient notice",
  "Skill mismatch",
  "Other",
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function hoursUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60));
}

const STATUS_BADGE: Record<SwapStatus, { label: string; bg: string; color: string }> = {
  pending_target: { label: "Waiting for employee", bg: "#fef3c7", color: "#92400e" },
  pending_manager: { label: "Pending approval", bg: "#dbeafe", color: "#1e40af" },
  approved:        { label: "Approved",           bg: "#d1fae5", color: "#065f46" },
  rejected:        { label: "Rejected",           bg: "#fee2e2", color: "#991b1b" },
  expired:         { label: "Expired",            bg: "#f3f4f6", color: "#6b7280" },
  cancelled:       { label: "Cancelled",          bg: "#f3f4f6", color: "#6b7280" },
};

interface RejectDialogProps {
  swapId: string;
  onClose: () => void;
}

function RejectDialog({ swapId, onClose }: RejectDialogProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState(MANAGER_REJECT_REASONS[0]);
  const [other, setOther] = useState("");

  const mutation = useMutation({
    mutationFn: (r: string) => resolveSwapRequest(swapId, { action: "reject", reason: r }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swap-requests"] });
      onClose();
    },
  });

  const finalReason = reason === "Other" ? other.trim() : reason;
  const canSubmit = reason !== "Other" || other.trim().length > 0;

  return (
    <div style={s.modalBackdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reject swap request"
        style={s.modal}
        onClick={(e) => e.stopPropagation()}
        data-testid="reject-dialog"
      >
        <div style={s.modalHeader}>
          <h3 style={s.modalTitle}>Reject Swap Request</h3>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={s.modalBody}>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
              Reason for rejection
            </legend>
            {MANAGER_REJECT_REASONS.map((r) => (
              <label key={r} style={s.radioLabel}>
                <input type="radio" name="reject-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                <span style={{ marginLeft: 8 }}>{r}</span>
              </label>
            ))}
            {reason === "Other" && (
              <textarea
                style={s.textarea}
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Describe reason..."
                rows={3}
                aria-label="Other rejection reason"
              />
            )}
          </fieldset>
          {mutation.isError && (
            <div role="alert" style={s.errorBox}>Failed to reject. Please try again.</div>
          )}
        </div>
        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button
            style={{ ...s.rejectBtn, ...(canSubmit ? {} : { opacity: 0.5, cursor: "not-allowed" }) }}
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate(finalReason)}
            data-testid="confirm-reject-btn"
          >
            {mutation.isPending ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SwapRowProps {
  swap: SwapRequest;
  isPending: boolean;
}

function SwapRow({ swap, isPending }: SwapRowProps) {
  const qc = useQueryClient();
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => resolveSwapRequest(swap.id, { action: "approve" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swap-requests"] });
      setConfirmApprove(false);
    },
  });

  const nameA = `${swap.requestingEmployee.firstName} ${swap.requestingEmployee.lastName}`;
  const nameB = `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`;
  const badge = STATUS_BADGE[swap.status];
  const hoursLeft = hoursUntil(swap.expiresAt);
  const urgent = isPending && hoursLeft > 0 && hoursLeft <= 4;

  return (
    <>
      <tr style={s.tr} data-testid={`swap-row-${swap.id}`}>
        <td style={s.td}>
          <div style={s.swapNames}>{nameA} ⇄ {nameB}</div>
          <div style={s.swapDate}>{formatDateTime(swap.requestingShift.startTime)}</div>
        </td>
        <td style={s.td}>
          <div style={s.shiftDetail}>
            <span style={s.shiftLabel}>{nameA}:</span>{" "}
            {formatDateTime(swap.requestingShift.startTime)}
          </div>
          <div style={s.shiftDetail}>
            <span style={s.shiftLabel}>{nameB}:</span>{" "}
            {formatDateTime(swap.targetShift.startTime)}
          </div>
        </td>
        <td style={s.td}>
          <div style={s.timeAgo}>{timeAgo(swap.createdAt)}</div>
          {urgent && (
            <div style={s.urgentTag}>⚠ Expires in {hoursLeft}h</div>
          )}
        </td>
        <td style={s.td}>
          <span style={{ ...s.statusBadge, background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </td>
        <td style={s.tdActions}>
          {isPending && (
            confirmApprove ? (
              <div style={s.inlineConfirm}>
                <span style={s.confirmText}>
                  Approve swap between {nameA} and {nameB}?{" "}
                  <em>Schedules will update immediately.</em>
                </span>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    style={s.approveBtn}
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                    data-testid={`confirm-approve-${swap.id}`}
                  >
                    {approveMutation.isPending ? "Approving..." : "Confirm"}
                  </button>
                  <button style={s.cancelBtn} onClick={() => setConfirmApprove(false)}>Go back</button>
                </div>
                {approveMutation.isError && (
                  <div role="alert" style={{ ...s.errorBox, marginTop: 6 }}>
                    Failed to approve.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  style={s.approveBtn}
                  onClick={() => setConfirmApprove(true)}
                  data-testid={`approve-${swap.id}`}
                >
                  Approve
                </button>
                <button
                  style={s.rejectBtn}
                  onClick={() => setShowRejectDialog(true)}
                  data-testid={`reject-${swap.id}`}
                >
                  Reject
                </button>
              </div>
            )
          )}
          {!isPending && (
            <span style={s.resolvedNote}>
              {swap.resolvedAt ? new Date(swap.resolvedAt).toLocaleDateString() : "—"}
            </span>
          )}
        </td>
      </tr>
      {showRejectDialog && (
        <RejectDialog swapId={swap.id} onClose={() => setShowRejectDialog(false)} />
      )}
    </>
  );
}

export function ManagerSwapRequestsPage() {
  const [tab, setTab] = useState<"pending" | "resolved">("pending");

  const { data: allSwaps = [], isLoading, error } = useQuery({
    queryKey: ["swap-requests", "manager"],
    queryFn: () => fetchSwapRequests(),
  });

  const pendingSwaps = allSwaps.filter((s) => s.status === "pending_manager");
  const resolvedSwaps = allSwaps.filter((s) =>
    ["approved", "rejected", "expired", "cancelled"].includes(s.status)
  );
  const shown = tab === "pending" ? pendingSwaps : resolvedSwaps;

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
        <div style={s.pageHeader}>
          <div>
            <h1 style={s.pageTitle}>
              Swap Requests
              {pendingSwaps.length > 0 && (
                <span
                  style={s.badge}
                  aria-label={`${pendingSwaps.length} pending swap requests`}
                >
                  {pendingSwaps.length}
                </span>
              )}
            </h1>
            <p style={s.subtitle}>Review and action shift swap requests from your team</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === "pending" ? s.tabActive : {}) }}
            onClick={() => setTab("pending")}
            data-testid="tab-pending"
          >
            Pending {pendingSwaps.length > 0 && `(${pendingSwaps.length})`}
          </button>
          <button
            style={{ ...s.tab, ...(tab === "resolved" ? s.tabActive : {}) }}
            onClick={() => setTab("resolved")}
            data-testid="tab-resolved"
          >
            Resolved
          </button>
        </div>

        {isLoading && <div style={s.stateMsg}>Loading swap requests...</div>}
        {error && (
          <div style={{ ...s.stateMsg, color: "#dc2626" }}>
            Failed to load swap requests.
          </div>
        )}

        {!isLoading && !error && shown.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>🔄</div>
            <div style={s.emptyTitle}>
              {tab === "pending" ? "No pending swap requests" : "No resolved swap requests"}
            </div>
            {tab === "pending" && (
              <div style={s.emptySubtext}>
                Swap requests from your team will appear here.
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && shown.length > 0 && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Swap", "Shift Details", "Received", "Status", "Actions"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((swap) => (
                  <SwapRow key={swap.id} swap={swap} isPending={tab === "pending"} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageWrapper: { minHeight: "100vh", background: "#f8fafc" },
  page: { maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px", fontFamily: "system-ui, sans-serif" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  pageTitle: { margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 10 },
  subtitle: { margin: 0, color: "#6b7280", fontSize: 14 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    height: 22,
    background: "#4f46e5",
    color: "#fff",
    borderRadius: 11,
    fontSize: 12,
    fontWeight: 700,
    padding: "0 6px",
  },
  tabs: { display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 20 },
  tab: {
    padding: "8px 20px",
    background: "none",
    border: "none",
    fontSize: 14,
    fontWeight: 500,
    color: "#6b7280",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
  },
  tabActive: { color: "#4f46e5", borderBottomColor: "#4f46e5" },
  stateMsg: { textAlign: "center" as const, padding: 40, color: "#6b7280" },
  emptyState: { textAlign: "center" as const, padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: "#374151" },
  emptySubtext: { fontSize: 14, color: "#9ca3af" },
  tableWrap: { border: "1px solid #e5e7eb", borderRadius: 8, overflow: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 700 },
  th: {
    padding: "10px 14px",
    background: "#f9fafb",
    color: "#374151",
    fontWeight: 600,
    fontSize: 12,
    textAlign: "left" as const,
    borderBottom: "1px solid #e5e7eb",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    whiteSpace: "nowrap" as const,
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "12px 14px", color: "#374151", verticalAlign: "top" },
  tdActions: { padding: "10px 14px", verticalAlign: "top" },
  swapNames: { fontWeight: 600, color: "#111827", fontSize: 13 },
  swapDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  shiftDetail: { fontSize: 13, color: "#374151" },
  shiftLabel: { fontWeight: 600 },
  timeAgo: { fontSize: 13, color: "#6b7280" },
  urgentTag: { fontSize: 11, color: "#d97706", fontWeight: 600, marginTop: 3 },
  statusBadge: { padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 },
  resolvedNote: { fontSize: 12, color: "#9ca3af" },
  inlineConfirm: { background: "#fef9f0", border: "1px solid #fde68a", borderRadius: 7, padding: "10px 12px" },
  confirmText: { fontSize: 13, color: "#374151" },
  approveBtn: { padding: "7px 14px", border: "none", borderRadius: 6, background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 },
  rejectBtn: { padding: "7px 14px", border: "1px solid #fecaca", borderRadius: 6, background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 13 },
  cancelBtn: { padding: "7px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" },
  errorBox: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, padding: "7px 10px", fontSize: 12 },
  radioLabel: { display: "flex", alignItems: "center", fontSize: 14, color: "#374151", marginBottom: 8, cursor: "pointer" },
  textarea: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 },
  modal: { background: "#fff", borderRadius: 10, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "system-ui, sans-serif" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 600 },
  modalBody: { padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid #e5e7eb" },
  closeBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" },
};
