/**
 * useCopyWeekSpotlight
 *
 * Manages show/hide state and dismissal persistence for the Copy Week
 * onboarding spotlight.
 *
 * Trigger: spotlight shows when the user opens their second distinct schedule
 * (scheduleViewCount === 2) and has not yet dismissed it.
 *
 * Persistence: localStorage key `ux_spotlight_copy_week_v1`.
 * If a server-side User Preferences API becomes available, replace the
 * localStorage read/write with API calls here.
 */

import { useEffect, useState } from "react";

const DISMISSED_KEY = "ux_spotlight_copy_week_v1";
const VISITED_KEY = "ux_schedules_visited_v1";

function getVisitedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveVisitedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — ignore
  }
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const val = JSON.parse(raw) as { dismissed?: boolean };
    return val.dismissed === true;
  } catch {
    return false;
  }
}

function saveDismissal(via: string): void {
  try {
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({
        dismissed: true,
        dismissedAt: new Date().toISOString(),
        dismissedVia: via,
      })
    );
  } catch {
    // localStorage unavailable — ignore
  }
}

export interface UseCopyWeekSpotlightResult {
  /** Whether the spotlight overlay should be visible */
  showSpotlight: boolean;
  /** Call when user clicks "Got it, thanks" */
  dismissSpotlight: (via?: string) => void;
  /** Call when user clicks "Try it now" — also opens copy-week flow */
  acceptSpotlight: () => void;
}

export function useCopyWeekSpotlight(scheduleId: string | undefined): UseCopyWeekSpotlightResult {
  const [showSpotlight, setShowSpotlight] = useState(false);

  useEffect(() => {
    if (!scheduleId) return;
    if (isDismissed()) return;

    const visited = getVisitedIds();

    // Add current schedule to visited set
    const wasNew = !visited.has(scheduleId);
    if (wasNew) {
      visited.add(scheduleId);
      saveVisitedIds(visited);
    }

    // Show spotlight on the second unique schedule visit (count === 2)
    if (visited.size === 2) {
      setShowSpotlight(true);
    }
  }, [scheduleId]);

  function dismissSpotlight(via = "got_it") {
    setShowSpotlight(false);
    saveDismissal(via);
  }

  function acceptSpotlight() {
    dismissSpotlight("try_it_now");
  }

  return { showSpotlight, dismissSpotlight, acceptSpotlight };
}
