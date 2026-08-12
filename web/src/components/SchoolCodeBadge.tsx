"use client";

import { useState } from "react";

type Props = {
  code: string | null | undefined;
  variant?: "inline" | "card";
};

export function SchoolCodeBadge({ code, variant = "inline" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!code) {
    return <span className="text-sm text-amber-300">No login code assigned</span>;
  }

  if (variant === "card") {
    return (
      <div className="rounded-2xl border border-[#7ec8c8]/40 bg-[#7ec8c8]/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7ec8c8]">
          School login code
        </p>
        <p className="mt-1 text-sm text-white/70">
          Admins, teachers, and students enter this code on their portal login when prompted.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-black/30 px-3 py-2 font-mono text-lg font-bold tracking-wider text-white">
            {code}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-md bg-[#7ec8c8]/20 px-2 py-0.5 font-mono text-sm font-semibold text-[#7ec8c8]">
        {code}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        className="text-xs text-white/60 hover:text-white"
        title="Copy school code"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
