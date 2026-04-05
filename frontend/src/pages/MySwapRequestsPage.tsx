/**
 * MySwapRequestsPage — TIM-197
 *
 * Employee view: My Swap Requests (Active + Past tabs).
 * UX spec Screen 5.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSwapRequests,
  cancelSwapRequest,
  SwapRequest,
  SwapStatus,
} from "../api/swapRequests";
import { IncomingSwapDetail } from "../components/swapRequests/IncomingSwapDetail";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";

const ACTIVE_STATUSES: SwapStatus[] = ["pending_target", "pending_manager"];
const PAST_STATUSES: SwapStatus[] = ["approved", "rejected", "expired", "cancelled"];

const STATUS_BADGE: Record<SwapStatus, { label: string; bg: string; color: string }> = {
  pending_target: { label: "Waiting for response", bg: "#fef3c7", color: "#92400e" },
  pending_manager:{ label: "Awaiting manager approval", bg: "#dbeafe",  color: "#1e40af" },
  approved:       { label: "Approved",                  bg: "#d1fae5",  color: "#065f46" },
  rejected:       { label: "Rejected",                  bg: "#fee2e2",  color: "#991b1b" },
  expired:        { label: "Expired",                   bg: "#f3f4f6",  color: "#6b7280" },
  cancelled:      { label: "Cancelled",                 bg: "#f3f4f6",  color: "#6b7280" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface SwapCardProps {
  swap: SwapRequest;
  currentUserId: string | undefined;
  isActive: boolean;
}

function SwapCard({ swap, currentUserId, isActive }: SwapCardProps) {
  const qc = useQueryClient();
  const [viewDetail, setViewDetail] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: () => cancelSwapRequest(swap.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swap-requests"] });
      setConfirmCancel(false);
    },
  });

  const isOutgoing = swap.requestingEmployee.id === currentUserId;
  const badge = STATUS_BADGE[swap.status];

  const otherPerson = isOutgoing
    ? `${swap.targetEmployee.firstName} ${swap.targetEmployee.lastName}`
    : `${swap.requestingEmployee.firstName} ${swap.requestingEmployee.lastName}`;

  const myShift = isOutgoing ? swap.requestingShift : swap.targetShift;
  const theirShift = isOutgoing ? swap.targetShift : swap.requestingShift;

  const canCancel = isActive && isOutgoing && swap.status === "pending_target";
  const isIncoming = !isOutgoing && swap.status === "pending_target";

  return (
    <>
      <div style={s.card} data-testid={`swap-card-${swap.id}`}>
        <div style={s.cardTop}>
          <div style={s.cardLeft}>
            <div style={s.cardTitle}>
              {isOutgoing ? `Swap request to ${otherPerson}` : `Incoming request from ${otherPerson}`}
            </div>
            <div style={s.cardMeta}>
              {formatDate(myShift.startTime)} · {formatTime(myShift.startTime)}–{formatTime(myShift.endTime)}
              {myShift.role && ` · ${myShift.role}`}
            </div>
            <div style={{ ...s.cardMeta, color: "#9ca3af" }}>
              Their shift: {formatDate(theirShift.startTime)} · {formatTime(theirShift.startTime)}–{formatTime(theirShift.endTime)}
            </div>
          </div>
          <div style={s.cardRight}>
            <span style={{ ...s.statusBadge, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
            {swap.status === "rejected" && swap.declineReason && (
              <div style={s.rejectReason}>Reason: {swap.declineReason}</div>
            )}
          </div>
        </div>

        {(canCancel || isIncoming) && (
          <div style={s.cardActions}>
            {isIncoming && (
              <button
                style={s.viewBtn}
                onClick={() => setViewDetail(true)}
                data-testid={`view-incoming-${swap.id}`}
              >
                View &amp; Respond
              </button>
            )}
            {canCancel && (
              confirmCancel ? (
                <div style={s.cancelConfirm}>
                  <span style={s.cancelConfirmText}>
                    Cancel this swap request? {otherPerson} will be notified.
                  </span>
                  <button
                    style={s.cancelConfirmBtn}
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate()}
                    data-testid={`confirm-cancel-${swap.id}`}
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Confirm"}
                  </button>
                  <button style={s.goBackBtn} onClick={() => setConfirmCancel(false)}>
                    Go back
                  </button>
                  {cancelMutation.isError && (
                    <span style={s.errorInline}>Failed to cancel.</span>
                  )}
                </div>
              ) : (
                <button
                  style={s.cancelLink}
                  onClick={() => setConfirmCancel(true)}
                  data-testid={`cancel-swap-${swap.id}`}
                >
                  Cancel request
                </button>
              )
            )}
          </div>
        )}
      </div>

      {viewDetail && (
        <IncomingSwapDetail
          swapRequest={swap}
          onClose={() => setViewDetail(false)}
        />
      )}
    </>
  );
}

export function MySwapRequestsPage() {
  const [tab, setTab] = useState<"active" | "past">("active");
  const { user } = useAuth();

  const { data: allSwaps = [], isLoading, error } = useQuery({
    queryKey: ["swap-requests", "mine"],
    queryFn: () => fetchSwapRequests(),
  });

  const activeSwaps = allSwaps.filter((s) =>
    ACTIVE_STATUSES.includes(s.status)
  );
  const pastSwaps = allSwaps.filter((s) =>
    PAST_STATUSES.includes(s.status)
  );
  const shown = tab === "active" ? activeSwaps : pastSwaps;

  return (
    <div style={s.pageWrapper}>
      <Navbar />
      <div style={s.page}>
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>
            My Swap Requests
            {activeSwaps.length > 0 && (
              <span style={s.badge}>{activeSwaps.length}</span>
            )}
          </h1>
          <p style={s.subtitle}>Track your outgoing and incoming shift swap requests</p>
        </div>

        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === "active" ? s.tabActive : {}) }}
            onClick={() => setTab("active")}
            data-testid="tab-active"
          >
            Active {activeSwaps.length > 0 && `(${activeSwaps.length})`}
          </button>
          <button
            style={{ ...s.tab, ...(tab === "past" ? s.tabActive : {}) }}
            onClick={() => setTab("past")}
            data-testid="tab-past"
          >
            Past
          </button>
        </div>

        {isLoading && <div style={s.stateMsg}>Loading...</div>}
        {error && <div style={{ ...s.stateMsg, color: "#dc2626" }}>Failed to load swap requests.</div>}

        {!isLoading && !error && shown.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>🔄</div>
            <div style={s.emptyTitle}>
              {tab === "active" ? "No active swap requests" : "No past swap requests"}
            </div>
            {tab === "active" && (
              <div style={s.emptySubtext}>
                Tap "Request Swap" on any upcoming shift to get started.
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && shown.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shown.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                currentUserId={user?.id}
                isActive={tab === "active"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageWrapper: { minHeight: "100vh", background: "#f8fafc" },
  page: { maxWidth: 760, margin: "0 auto", padding: "24px 24px 48px", fontFamily: "system-ui, sans-serif" },
  pageHeader: { marginBottom: 20 },
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
  tabs: { display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 20 },
  tab: { padding: "8px 20px", background: "none", border: "none", fontSize: 14, fontWeight: 500, color: "#6b7280", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -2 },
  tabActive: { color: "#4f46e5", borderBottomColor: "#4f46e5" },
  stateMsg: { textAlign: "center" as const, padding: 40, color: "#6b7280" },
  emptyState: { textAlign: "center" as const, padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: 600, color: "#374151" },
  emptySubtext: { fontSize: 14, color: "#9ca3af" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  cardLeft: { flex: 1, minWidth: 0 },
  cardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: "#111827" },
  cardMeta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  statusBadge: { padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" as const },
  rejectReason: { fontSize: 12, color: "#9ca3af", maxWidth: 200, textAlign: "right" as const },
  cardActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, borderTop: "1px solid #f3f4f6", paddingTop: 10 },
  viewBtn: { padding: "7px 16px", border: "1.5px solid #4f46e5", borderRadius: 6, background: "#fff", color: "#4f46e5", cursor: "pointer", fontSize: 13, fontWeight: 500 },
  cancelLink: { background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, textDecoration: "underline" },
  cancelConfirm: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  cancelConfirmText: { fontSize: 13, color: "#374151" },
  cancelConfirmBtn: { padding: "5px 12px", border: "none", borderRadius: 5, background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13 },
  goBackBtn: { padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" },
  errorInline: { fontSize: 12, color: "#dc2626" },
};
