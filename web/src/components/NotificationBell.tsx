"use client";

// Purpose: Push-style notification drawer — full-screen sheet on mobile, panel on desktop.
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiRequestError } from "@/lib/api";
import type { Announcement } from "@/lib/types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  const lastFetchRef = useRef(0);

  const load = useCallback(async () => {
    lastFetchRef.current = Date.now();
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

  // Poll only while the tab is visible to avoid draining mobile data in the background.
  useEffect(() => {
    const POLL_MS = 300000; // 5 minutes
    const MIN_GAP_MS = 60000; // don't refetch more than once a minute on focus

    void load();

    let id: number | undefined;
    const start = () => {
      if (id !== undefined) return;
      id = window.setInterval(() => {
        if (document.visibilityState === "visible") void load();
      }, POLL_MS);
    };
    const stop = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastFetchRef.current > MIN_GAP_MS) void load();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((i) => !i.read).length;

  async function openItem(item: Announcement) {
    if (!item.read) {
      try {
        await api(`/api/announcements/${item.id}/read`, { method: "POST" });
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      } catch (err) {
        console.error(err instanceof ApiRequestError ? err.message : err);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            // Only refetch when opening, and not if we just fetched.
            if (next && Date.now() - lastFetchRef.current > 15000) void load();
            return next;
          });
        }}
        className="relative inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:bg-brand-soft"
      >
        <span className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
            <path d="M9 17a3 3 0 0 0 6 0" />
          </svg>
          {unread > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </span>
        <span className="hidden sm:inline">Alerts</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Notifications">
          <button
            type="button"
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            aria-label="Dismiss notifications"
            onClick={() => setOpen(false)}
          />

          {/* Mobile: full-screen push sheet from top. Desktop: anchored panel. */}
          <div
            className={clsx(
              "absolute flex flex-col bg-bg-elevated shadow-[var(--shadow)]",
              "inset-x-0 top-0 max-h-[100dvh] w-full animate-[slideDown_0.28s_ease-out]",
              "sm:inset-auto sm:right-4 sm:top-4 sm:max-h-[min(85vh,36rem)] sm:w-[min(100vw-2rem,24rem)] sm:rounded-3xl sm:border sm:border-line"
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Push alerts</p>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  Notifications
                </h2>
              </div>
              <button
                type="button"
                className="rounded-xl border border-line px-3 py-2 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
              {loading && items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">Loading alerts…</p>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No notifications yet</p>
              ) : (
                <ul className="space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {items.map((item, index) => (
                    <li
                      key={item.id}
                      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                      className="animate-[pushIn_0.35s_ease-out_both]"
                    >
                      <button
                        type="button"
                        onClick={() => void openItem(item)}
                        className={clsx(
                          "w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition",
                          item.read
                            ? "border-line bg-white"
                            : "border-brand/25 bg-brand-soft ring-1 ring-brand/10"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{item.title}</p>
                          {!item.read ? (
                            <span className="mt-0.5 shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              New
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                        <p className="mt-2 text-[11px] text-muted">
                          {new Date(item.publishedAt).toLocaleString()}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
