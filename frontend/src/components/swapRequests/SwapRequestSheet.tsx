/**
 * SwapRequestSheet — TIM-197
 *
 * Employee-facing modal for initiating a shift swap request.
 * Covers UX spec Screens 1 and 2:
 *   - Shift summary (read-only)
 *   - Coworker picker with live search
 *   - Optional message textarea
 *   - Send Request CTA
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSwapRequest,
  fetchEligibleCoworkers,
  EligibleCoworker,
} from "../../api/swapRequests";
import type { Shift } from "../../api/shifts";

interface Props {
  shift: Shift;
  onClose: () => void;
}

function formatShiftTime(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${new Date(start).toLocaleTimeString([], opts)} – ${new Date(end).toLocaleTimeString([], opts)}`;
}

function formatShiftDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  return (
    <span style={s.avatar} aria-hidden="true">
      {letters.toUpperCase()}
    </span>
  );
}

export function SwapRequestSheet({ shift, onClose }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EligibleCoworker | null>(null);
  const [message, setMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: coworkers = [], isLoading: loadingCoworkers } = useQuery({
    queryKey: ["eligible-coworkers", shift.id],
    queryFn: () => fetchEligibleCoworkers(shift.id),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createSwapRequest({
        requestingShiftId: shift.id,
        targetEmployeeId: selected!.id,
        targetShiftId: selected!.shift!.id,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swap-requests"] });
      const name = `${selected!.firstName} ${selected!.lastName}`;
      setSuccessMsg(`Swap request sent to ${name}`);
      // Auto-close after a moment
      setTimeout(onClose, 2000);
    },
  });

  const filtered = coworkers.filter((c) => {
    const full = `${c.firstName} ${c.lastName}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  function handleSelectCoworker(c: EligibleCoworker) {
    if (c.hasPendingRequest || !c.shift) return;
    setSelected(c);
    setPickerOpen(false);
    setSearch("");
  }

  const canSubmit = !!selected && !mutation.isPending;

  return (
    <div style={s.backdrop} onClick={onClose} data-testid="swap-sheet-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-sheet-heading"
        style={s.sheet}
        onClick={(e) => e.stopPropagation()}
        data-testid="swap-sheet"
      >
        {/* Header */}
        <div style={s.header}>
          <h2 style={s.heading} id="swap-sheet-heading">
            Request Shift Swap
          </h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div style={s.body}>
          {/* Shift summary */}
          <div style={s.shiftSummary}>
            <span style={s.shiftSummaryLabel}>Shift</span>
            <span style={s.shiftSummaryValue}>
              {formatShiftDate(shift.startTime)} · {formatShiftTime(shift.startTime, shift.endTime)}
              {shift.role && ` · ${shift.role}`}
            </span>
          </div>

          {/* Coworker picker */}
          <div>
            <p style={s.sectionLabel}>Who do you want to swap with?</p>

            {selected ? (
              <div style={s.selectedChip} data-testid="selected-coworker-chip">
                <Initials name={`${selected.firstName} ${selected.lastName}`} />
                <span style={s.chipName}>
                  {selected.firstName} {selected.lastName}
                </span>
                <button
                  style={s.chipClear}
                  onClick={() => setSelected(null)}
                  aria-label="Clear selection"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                style={s.pickerTrigger}
                onClick={() => setPickerOpen(true)}
                data-testid="open-picker-btn"
              >
                Select a coworker...
              </button>
            )}

            {pickerOpen && (
              <div style={s.pickerDropdown} data-testid="coworker-picker">
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={true}
                  aria-label="Search coworkers"
                  placeholder="Search by name..."
                  style={s.searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  data-testid="coworker-search"
                />
                {loadingCoworkers ? (
                  <div style={s.pickerMsg}>Loading...</div>
                ) : filtered.length === 0 ? (
                  <div style={s.pickerEmpty}>
                    <div style={s.pickerEmptyTitle}>No coworkers found</div>
                    <div style={s.pickerEmptySubtext}>
                      Only coworkers on the same schedule are eligible.
                    </div>
                  </div>
                ) : (
                  <ul style={s.pickerList} role="listbox" aria-label="Eligible coworkers">
                    {filtered.map((c) => {
                      const disabled = c.hasPendingRequest || !c.shift;
                      const name = `${c.firstName} ${c.lastName}`;
                      return (
                        <li
                          key={c.id}
                          role="option"
                          aria-selected={false}
                          aria-disabled={disabled}
                          style={{
                            ...s.pickerItem,
                            ...(disabled ? s.pickerItemDisabled : {}),
                          }}
                          onClick={() => !disabled && handleSelectCoworker(c)}
                          data-testid={`coworker-option-${c.id}`}
                        >
                          <Initials name={name} />
                          <div style={s.pickerItemInfo}>
                            <div style={s.pickerItemName}>{name}</div>
                            {c.role && (
                              <div style={s.pickerItemMeta}>{c.role}</div>
                            )}
                            {c.shift && (
                              <div style={s.pickerItemMeta}>
                                {formatShiftTime(c.shift.startTime, c.shift.endTime)}
                              </div>
                            )}
                            {!c.shift && (
                              <div style={{ ...s.pickerItemMeta, color: "#d97706" }}>
                                No shift on that day
                              </div>
                            )}
                          </div>
                          {c.hasPendingRequest && (
                            <span
                              style={s.pendingTag}
                              title="Request already pending"
                            >
                              Request pending
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Optional message */}
          <label style={s.msgLabel}>
            <span style={s.msgLabelText}>
              Your message{" "}
              <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
            </span>
            <textarea
              style={s.msgTextarea}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 160))}
              placeholder="Add a note for your coworker..."
              rows={3}
              maxLength={160}
              aria-label="Message to coworker"
              data-testid="swap-message-input"
            />
            <span style={s.charCount}>{message.length}/160</span>
          </label>

          {/* Mutation error */}
          {mutation.isError && (
            <div role="alert" style={s.errorBox} data-testid="swap-error">
              {(mutation.error as Error)?.message ?? "Failed to send request. Please try again."}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div role="status" style={s.successBox} data-testid="swap-success">
              ✓ {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button
            style={s.cancelBtn}
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            style={{
              ...s.sendBtn,
              ...(canSubmit ? {} : s.sendBtnDisabled),
            }}
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
            data-testid="send-swap-request-btn"
          >
            {mutation.isPending ? "Sending..." : "Send Request"}
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
    padding: 0,
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
    lineHeight: 1,
    padding: 0,
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
  shiftSummary: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "10px 14px",
    display: "flex",
    gap: 10,
    alignItems: "baseline",
  },
  shiftSummaryLabel: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" },
  shiftSummaryValue: { fontSize: 14, color: "#111827", fontWeight: 500 },
  sectionLabel: { margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#374151" },
  selectedChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    borderRadius: 20,
    padding: "4px 10px 4px 4px",
  },
  chipName: { fontSize: 13, fontWeight: 500, color: "#3730a3" },
  chipClear: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6b7280",
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
    marginLeft: 4,
  },
  avatar: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#e0e7ff",
    color: "#3730a3",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  pickerTrigger: {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px dashed #d1d5db",
    borderRadius: 8,
    background: "#fafafa",
    color: "#9ca3af",
    cursor: "pointer",
    textAlign: "left" as const,
    fontSize: 14,
  },
  pickerDropdown: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fff",
    overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    marginTop: 4,
  },
  searchInput: {
    width: "100%",
    padding: "10px 14px",
    border: "none",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  pickerMsg: { padding: "12px 16px", fontSize: 14, color: "#6b7280" },
  pickerEmpty: { padding: "16px" },
  pickerEmptyTitle: { fontSize: 14, fontWeight: 500, color: "#374151" },
  pickerEmptySubtext: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  pickerList: { listStyle: "none", margin: 0, padding: 0, maxHeight: 220, overflowY: "auto" },
  pickerItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #f3f4f6",
    transition: "background 0.1s",
  },
  pickerItemDisabled: { opacity: 0.5, cursor: "default" },
  pickerItemInfo: { flex: 1, minWidth: 0 },
  pickerItemName: { fontSize: 14, fontWeight: 500, color: "#111827" },
  pickerItemMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  pendingTag: {
    fontSize: 11,
    color: "#92400e",
    background: "#fef3c7",
    borderRadius: 4,
    padding: "2px 6px",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  msgLabel: { display: "flex", flexDirection: "column", gap: 4 },
  msgLabelText: { fontSize: 13, fontWeight: 600, color: "#374151" },
  msgTextarea: {
    resize: "vertical" as const,
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#111827",
  },
  charCount: { fontSize: 11, color: "#9ca3af", alignSelf: "flex-end" },
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
    padding: "8px 12px",
    fontSize: 14,
    fontWeight: 500,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "12px 20px",
    borderTop: "1px solid #e5e7eb",
    flexShrink: 0,
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
  sendBtn: {
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
  sendBtnDisabled: { background: "#c7d2fe", cursor: "not-allowed" },
};
