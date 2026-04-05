/**
 * CopyWeekSpotlight
 *
 * First-time-use onboarding spotlight for the Copy Week button.
 * Spec: TIM-186 (UX design) / TIM-187 (implementation).
 *
 * Desktop: scrim + anchored tooltip card below the Copy Week button.
 * Mobile (<768 px): scrim + bottom-sheet card.
 * Dismissal: "Got it, thanks" or "Try it now" (both persist dismissal state).
 * Keyboard: Escape key dismisses. Focus is trapped inside the card.
 * Animation: respects prefers-reduced-motion.
 */

import { useEffect, useRef, useCallback } from "react";

interface Props {
  /** Ref to the Copy Week button, used to position the tooltip */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onDismiss: () => void;
  onTryItNow: () => void;
}

export function CopyWeekSpotlight({ anchorRef, onDismiss, onTryItNow }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus the card heading when spotlight appears
  useEffect(() => {
    const heading = cardRef.current?.querySelector<HTMLElement>("[data-spotlight-heading]");
    heading?.focus();
  }, []);

  // Escape key to dismiss; also trap focus inside card
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;

      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      style={s.scrim}
      onClick={onDismiss}
      data-testid="spotlight-scrim"
    >
      {/* Stop click propagation so clicking the card doesn't dismiss */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-heading"
        style={s.card}
        onClick={(e) => e.stopPropagation()}
        data-testid="spotlight-card"
      >
        <button
          style={s.closeBtn}
          aria-label="Dismiss spotlight"
          onClick={onDismiss}
        >
          ×
        </button>

        <p style={s.headline} id="spotlight-heading" tabIndex={-1} data-spotlight-heading>
          ✨ Save time with Copy Week
        </p>
        <p style={s.body}>
          Instantly duplicate this week's shifts to any future week. Great for
          recurring schedules.
        </p>

        <div style={s.actions}>
          <button style={s.tryBtn} onClick={onTryItNow}>
            Try it now
          </button>
          <button style={s.dismissBtn} onClick={onDismiss}>
            Got it, thanks
          </button>
        </div>
      </div>

      {/* Highlight ring around anchor button — desktop only */}
      <AnchorHighlight anchorRef={anchorRef} />
    </div>
  );
}

// Renders a pulsing ring around the Copy Week button on desktop
function AnchorHighlight({
  anchorRef,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  if (!anchorRef.current) return null;

  const rect = anchorRef.current.getBoundingClientRect();
  const GAP = 6;

  return (
    <div
      style={{
        ...s.highlightRing,
        top: rect.top - GAP,
        left: rect.left - GAP,
        width: rect.width + GAP * 2,
        height: rect.height + GAP * 2,
      }}
      aria-hidden="true"
      data-testid="spotlight-ring"
    />
  );
}

const isMobile = () =>
  typeof window !== "undefined" && window.innerWidth < 768;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const s: Record<string, React.CSSProperties> = {
  scrim: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 200,
    cursor: "pointer",
  },
  card: (() => {
    const mobile = isMobile();
    const base: React.CSSProperties = {
      position: "fixed",
      background: "#fff",
      borderRadius: 12,
      padding: "20px 20px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      maxWidth: 360,
      width: "calc(100% - 32px)",
      cursor: "default",
      fontFamily: "system-ui, sans-serif",
    };
    if (mobile) {
      return {
        ...base,
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        animation: prefersReducedMotion()
          ? "none"
          : "slideUp 250ms ease-out forwards",
      };
    }
    return {
      ...base,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  })(),
  closeBtn: {
    position: "absolute" as const,
    top: 10,
    right: 12,
    background: "none",
    border: "none",
    fontSize: 20,
    lineHeight: 1,
    color: "#9ca3af",
    cursor: "pointer",
    padding: 0,
    minWidth: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    margin: "0 0 8px",
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
    paddingRight: 28,
    outline: "none",
  },
  body: {
    margin: "0 0 16px",
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.55,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  tryBtn: {
    flex: 1,
    padding: "10px 14px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    minHeight: 44,
  },
  dismissBtn: {
    flex: 1,
    padding: "10px 14px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: 7,
    fontSize: 14,
    cursor: "pointer",
    minHeight: 44,
  },
  highlightRing: {
    position: "fixed",
    borderRadius: 10,
    border: "2px solid #818cf8",
    boxShadow: "0 0 0 4px rgba(99,102,241,0.25)",
    pointerEvents: "none",
    animation: prefersReducedMotion()
      ? "none"
      : "spotlightPulse 2s ease-in-out 2",
  },
};
