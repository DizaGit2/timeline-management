/**
 * IncomingSwapDetail — TIM-197
 *
 * Target employee accept/decline UI for an incoming swap request.
 * UX spec Screen 3.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { respondToSwapRequest, SwapRequest } from "../../api/swapRequests";

interface Props {
  swapRequest: SwapRequest;
  onClose: () => void;
}

const DECLINE_REASONS = [
  "I can't work that shift",
  "I changed my mind",
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

function hoursUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return hours;
}

export function IncomingSwapDetail({ swapRequest, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"view" | "confirm-accept" | "decline-reason" | "done">("view");
  const [declineReason, setDeclineReason] = useState(DECLINE_REASONS[0]);
  const [declineOther, setDeclineOther] = useState("");

  const respondMutation = useMutation({
    mutationFn: (payload: { action: "accept" | "decline"; reason?: string }) =>
      respondToSwapRequest(swapRequest.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swap-requests"] });
      setStep("done");
    },
  });

  const hoursLeft = hoursUntil(swapRequest.expiresAt);
  const isExpired = hoursLeft <= 0;

  const requestorName = `${swapRequest.requestingEmployee.firstName} ${swapRequest.requestingEmployee.lastName}`;

  if (isExpired) {
    return (
      <div style={s.backdrop} onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Incoming Swap Request"
          style={s.sheet}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={s.header}>
            <h2 style={s.heading}>Incoming Swap Request</h2>
            <button style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
          </div>
          <div style={s.body}>
            <div style={s.expiredBanner}>
              This request has expired and is no longer available.
            </div>
          </div>
          <div style={s.footer}>
            <button style={s.primaryBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    const accepted = respondMutation.data?.status === "pending_manager";
    return (
      <div style={s.backdrop} onClick={onClose}>
        <div role="dialog" aria-modal="true" style={s.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <h2 style={s.heading}>Incoming Swap Request</h2>
            <button style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
          </div>
          <div style={s.body}>
            <div role="status" style={s.successBox} data-testid="respond-success">
              {accepted
                ? `✓ Swap request accepted. Waiting for manager approval.`
                : `✓ Swap request declined.`}
            </div>
          </div>
          <div style={s.footer}>
            <button style={s.primaryBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm-accept") {
    return (
      <div style={s.backdrop} onClick={() => setStep("view")}>
        <div role="dialog" aria-modal="true" aria-label="Confirm swap acceptance" style={s.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <h2 style={s.heading}>Accept Swap?</h2>
            <button style={s.closeBtn} onClick={() => setStep("view")} aria-label="Close">×</button>
          </div>
          <div style={s.body}>
            <p style={s.confirmText}>
              Accept this swap? Your schedule will update only after manager approval.
            </p>
            {respondMutation.isError && (
              <div role="alert" style={s.errorBox}>
                Failed to respond. Please try again.
              </div>
            )}
          </div>
          <div style={s.footer}>
            <button style={s.cancelBtn} onClick={() => setStep("view")} disabled={respondMutation.isPending}>
              Go back
            </button>
            <button
              style={s.acceptBtn}
              disabled={respondMutation.isPending}
              onClick={() => respondMutation.mutate({ action: "accept" })}
              data-testid="confirm-accept-btn"
            >
              {respondMutation.isPending ? "Accepting..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "decline-reason") {
    const finalReason = declineReason === "Other" ? declineOther.trim() : declineReason;
    const canSubmitDecline = declineReason !== "Other" || declineOther.trim().length > 0;

    return (
      <div style={s.backdrop} onClick={() => setStep("view")}>
        <div role="dialog" aria-modal="true" aria-label="Decline swap request" style={s.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <h2 style={s.heading}>Decline Request</h2>
            <button style={s.closeBtn} onClick={() => setStep("view")} aria-label="Close">×</button>
          </div>
          <div style={s.body}>
            <fieldset style={s.fieldset}>
              <legend style={s.fieldsetLegend}>Reason for declining</legend>
              <div role="radiogroup" aria-label="Decline reason">
                {DECLINE_REASONS.map((r) => (
                  <label key={r} style={s.radioLabel}>
                    <input
                      type="radio"
                      name="decline-reason"
                      value={r}
                      checked={declineReason === r}
                      onChange={() => setDeclineReason(r)}
                    />
                    <span style={{ marginLeft: 8 }}>{r}</span>
                  </label>
                ))}
              </div>
              {declineReason === "Other" && (
                <textarea
                  style={{ ...s.msgTextarea, marginTop: 8 }}
                  value={declineOther}
                  onChange={(e) => setDeclineOther(e.target.value.slice(0, 160))}
                  placeholder="Please describe..."
                  rows={3}
                  aria-label="Other reason"
                  data-testid="decline-other-input"
                />
              )}
            </fieldset>
            {respondMutation.isError && (
              <div role="alert" style={s.errorBox}>
                Failed to decline. Please try again.
              </div>
            )}
          </div>
          <div style={s.footer}>
            <button style={s.cancelBtn} onClick={() => setStep("view")} disabled={respondMutation.isPending}>
              Go back
            </button>
            <button
              style={{ ...s.declineBtn, ...(canSubmitDecline ? {} : { opacity: 0.5, cursor: "not-allowed" }) }}
              disabled={!canSubmitDecline || respondMutation.isPending}
              onClick={() => respondMutation.mutate({ action: "decline", reason: finalReason })}
              data-testid="confirm-decline-btn"
            >
              {respondMutation.isPending ? "Declining..." : "Decline"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main view (step === "view")
  return (
    <div style={s.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-swap-heading"
        style={s.sheet}
        onClick={(e) => e.stopPropagation()}
        data-testid="incoming-swap-detail"
      >
        <div style={s.header}>
          <h2 style={s.heading} id="incoming-swap-heading">
            Incoming Swap Request
          </h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={s.body}>
          {/* Requestor info */}
          <div style={s.participantRow}>
            <span style={s.avatarLg} aria-hidden="true">
              {requestorName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div style={s.participantName}>{requestorName}</div>
              <div style={s.participantLabel}>wants to swap shifts with you</div>
            </div>
          </div>

          {/* Shift comparison */}
          <div style={s.swapGrid}>
            <div style={s.swapCard}>
              <div style={s.swapCardLabel}>They give you</div>
              <div style={s.swapCardDate}>{formatDateTime(swapRequest.requestingShift.startTime)}</div>
              {swapRequest.requestingShift.role && (
                <div style={s.swapCardRole}>{swapRequest.requestingShift.role}</div>
              )}
            </div>
            <div style={s.swapArrow}>⇄</div>
            <div style={s.swapCard}>
              <div style={s.swapCardLabel}>You give them</div>
              <div style={s.swapCardDate}>{formatDateTime(swapRequest.targetShift.startTime)}</div>
              {swapRequest.targetShift.role && (
                <div style={s.swapCardRole}>{swapRequest.targetShift.role}</div>
              )}
            </div>
          </div>

          {/* Requestor message */}
          {swapRequest.message && (
            <blockquote style={s.messageQuote}>
              "{swapRequest.message}"
            </blockquote>
          )}

          {/* Expiry */}
          {hoursLeft > 0 && (
            <div style={{ ...s.expiryNote, ...(hoursLeft <= 4 ? s.expiryUrgent : {}) }}>
              {hoursLeft <= 4 ? "⚠ " : ""}
              Expires in {hoursLeft}h
              {" "}
              <span style={{ color: "#9ca3af" }}>
                ({new Date(swapRequest.expiresAt).toLocaleDateString([], { month: "short", day: "numeric" })})
              </span>
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button
            style={s.declineLink}
            onClick={() => setStep("decline-reason")}
            data-testid="decline-btn"
          >
            Decline
          </button>
          <button
            style={s.acceptBtn}
            onClick={() => setStep("confirm-accept")}
            data-testid="accept-btn"
          >
            Accept Swap
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 100,
  },
  sheet: {
    background: "#fff",
    borderRadius: "12px 12px 0 0",
    width: "100%",
    maxWidth: 540,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  heading: { margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    color: "#9ca3af",
    minWidth: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowY: "auto",
    flex: 1,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    padding: "12px 20px",
    borderTop: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  participantRow: { display: "flex", gap: 12, alignItems: "center" },
  avatarLg: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#e0e7ff",
    color: "#3730a3",
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  participantName: { fontSize: 15, fontWeight: 600, color: "#111827" },
  participantLabel: { fontSize: 13, color: "#6b7280" },
  swapGrid: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 8,
    alignItems: "center",
  },
  swapCard: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "10px 12px",
  },
  swapCardLabel: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
  swapCardDate: { fontSize: 13, fontWeight: 500, color: "#111827" },
  swapCardRole: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  swapArrow: { fontSize: 20, color: "#9ca3af", textAlign: "center" as const },
  messageQuote: {
    margin: 0,
    padding: "10px 14px",
    background: "#f9fafb",
    borderLeft: "3px solid #d1d5db",
    color: "#374151",
    fontSize: 14,
    fontStyle: "italic",
  },
  expiryNote: { fontSize: 13, color: "#6b7280" },
  expiryUrgent: { color: "#d97706", fontWeight: 500 },
  expiredBanner: {
    padding: "14px 16px",
    background: "#f3f4f6",
    borderRadius: 8,
    color: "#6b7280",
    fontSize: 14,
  },
  confirmText: { fontSize: 14, color: "#374151", margin: 0 },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 7,
    padding: "8px 12px",
    fontSize: 13,
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: 7,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 500,
  },
  fieldset: { border: "none", padding: 0, margin: 0 },
  fieldsetLegend: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
    cursor: "pointer",
  },
  msgTextarea: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#111827",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
  },
  cancelBtn: {
    padding: "10px 18px",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
    minHeight: 44,
  },
  primaryBtn: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 7,
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    minHeight: 44,
  },
  acceptBtn: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 7,
    background: "#16a34a",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    minHeight: 44,
  },
  declineBtn: {
    padding: "10px 18px",
    border: "1px solid #fecaca",
    borderRadius: 7,
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 14,
    minHeight: 44,
  },
  declineLink: {
    background: "none",
    border: "none",
    color: "#dc2626",
    cursor: "pointer",
    fontSize: 14,
    textDecoration: "underline",
    padding: "8px",
    minHeight: 44,
  },
};
