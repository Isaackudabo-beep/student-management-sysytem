"use client";

// Purpose: Nav notification bell with unread badge and history panel.
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiRequestError } from "@/lib/api";
import type { Announcement } from "@/lib/types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ success: true; data: Announcement[] }>("/api/announcements/inbox");
      setItems(res.data);
    } catch {
      // ignore when offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const unread = items.filter((i) => !i.read).length;

  async function openItem(item: Announcement) {
    if (!item.read) {
      try {
        await api(`/api/announcements/${item.id}/read`, { method: "POST" });
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error(err instanceof ApiRequestError ? err.message : err);
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        className="relative rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold"
      >
        Notifications
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-line bg-bg-elevated p-3 shadow-[var(--shadow)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Notification history</p>
            <button type="button" className="text-xs text-muted" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {loading && items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No notifications yet</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={clsx(
                      "w-full rounded-xl border px-3 py-2 text-left transition",
                      item.read ? "border-line bg-white" : "border-brand/30 bg-brand-soft"
                    )}
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{item.body}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {new Date(item.publishedAt).toLocaleString()}
                      {!item.read ? " · Unread" : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
