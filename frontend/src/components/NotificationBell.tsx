import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
} from "../api/notifications";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recent = notifications.slice(0, 10);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
  }

  return (
    <div ref={containerRef} style={s.container}>
      <button
        style={s.bellBtn}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <span style={s.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <span style={s.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.dropdownHeader}>
            <span style={s.dropdownTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button
                style={s.markAllBtn}
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
              >
                {markAllMutation.isPending ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>

          <div style={s.list}>
            {recent.length === 0 && (
              <div style={s.empty}>No notifications yet.</div>
            )}
            {recent.map((n) => (
              <div
                key={n.id}
                style={{ ...s.item, ...(n.isRead ? s.itemRead : s.itemUnread) }}
                onClick={() => handleNotificationClick(n)}
              >
                {!n.isRead && <div style={s.unreadDot} />}
                <div style={s.itemBody}>
                  <div style={s.itemTitle}>{n.title}</div>
                  <div style={s.itemText}>{truncate(n.body)}</div>
                  <div style={s.itemTime}>{relativeTime(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-block",
  },
  bellBtn: {
    position: "relative",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px 8px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: {
    fontSize: 20,
    lineHeight: 1,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    background: "#dc2626",
    color: "#fff",
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 700,
    minWidth: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
    fontFamily: "system-ui, sans-serif",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 340,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
    zIndex: 100,
    overflow: "hidden",
    fontFamily: "system-ui, sans-serif",
  },
  dropdownHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #f3f4f6",
    background: "#f9fafb",
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
  },
  markAllBtn: {
    fontSize: 12,
    color: "#4f46e5",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
  },
  list: {
    maxHeight: 400,
    overflowY: "auto",
  },
  empty: {
    padding: "32px 16px",
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #f9fafb",
    transition: "background 0.1s",
  },
  itemUnread: {
    background: "#eff6ff",
  },
  itemRead: {
    background: "#fff",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#4f46e5",
    flexShrink: 0,
    marginTop: 5,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 2,
  },
  itemText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    lineHeight: 1.4,
  },
  itemTime: {
    fontSize: 11,
    color: "#9ca3af",
  },
};
