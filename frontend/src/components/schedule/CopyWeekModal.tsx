import { useState } from "react";
import axios from "axios";

interface CopyWeekResult {
  shifts: Array<{ id: string; [key: string]: unknown }>;
}

interface Props {
  isOpen: boolean;
  sourceWeekStart: Date;
  onClose: () => void;
  onSuccess: (result: CopyWeekResult) => void;
}

const API =
  (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ??
  "http://localhost:3000";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(date: Date): string {
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  const startStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}

function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const dayOfWeek = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d;
}

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function CopyWeekModal({ isOpen, sourceWeekStart, onClose, onSuccess }: Props) {
  const [targetValue, setTargetValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sourceISO = toISODate(sourceWeekStart);
  const targetWeekStart = targetValue ? getWeekStart(targetValue) : null;
  const targetISO = targetValue ? targetValue : null;

  const isSameWeek = targetISO !== null && targetISO === sourceISO;
  const isDisabled = !targetISO || isSameWeek || loading;

  async function handleConfirm() {
    if (!targetWeekStart) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post<CopyWeekResult>(
        `${API}/api/schedules/copy-week`,
        { sourceWeekStart: sourceISO, targetWeekStart: toISODate(targetWeekStart) },
        { headers: authHeader() }
      );
      onSuccess(data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg =
          err.response?.data?.error ?? "Failed to copy week. Please try again.";
        setError(msg);
      } else {
        setError("Failed to copy week. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Copy Week"
        style={s.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={s.header}>
          <h2 style={s.title}>Copy Week</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div style={s.body}>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Source week:</span>
            <span style={s.infoValue}>{formatWeekLabel(sourceWeekStart)}</span>
          </div>

          <label style={s.label}>
            <span style={s.labelText}>Copy to (target week)</span>
            <input
              type="date"
              aria-label="Target week"
              style={s.input}
              value={targetValue}
              onChange={(e) => {
                setTargetValue(e.target.value);
                setError(null);
              }}
            />
          </label>

          {isSameWeek && targetValue && (
            <div style={s.warning}>Cannot copy to itself — same week selected.</div>
          )}

          {targetISO && !isSameWeek && (
            <div style={s.targetPreview}>
              Target: <strong>{formatWeekLabel(targetWeekStart!)}</strong>
            </div>
          )}

          {error && (
            <div role="alert" style={s.errorBox}>
              {error}
            </div>
          )}
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            style={{ ...s.confirmBtn, ...(isDisabled ? s.confirmBtnDisabled : {}) }}
            disabled={isDisabled}
            onClick={handleConfirm}
            aria-label={loading ? "Copying" : "Confirm"}
          >
            {loading ? (
              <span data-testid="copy-loading-spinner">Copying…</span>
            ) : (
              "Copy"
            )}
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
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 10,
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
  },
  title: { margin: 0, fontSize: 17, fontWeight: 600, color: "#111827" },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    color: "#6b7280",
  },
  body: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  infoRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 14,
  },
  infoLabel: { color: "#6b7280", fontWeight: 500 },
  infoValue: { color: "#111827", fontWeight: 600 },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  labelText: { fontSize: 13, fontWeight: 500, color: "#374151" },
  input: {
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    fontFamily: "inherit",
    color: "#111827",
  },
  warning: {
    fontSize: 13,
    color: "#d97706",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 6,
    padding: "6px 10px",
  },
  targetPreview: {
    fontSize: 13,
    color: "#374151",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 6,
    padding: "6px 10px",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "12px 20px 16px",
    borderTop: "1px solid #f3f4f6",
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
  confirmBtn: {
    padding: "8px 20px",
    border: "none",
    borderRadius: 6,
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  confirmBtnDisabled: {
    background: "#c7d2fe",
    cursor: "not-allowed",
  },
};
