"use client";

// Purpose: Admin selective promotion / repeat after Third Term (average ≥ 45%).
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import type { SchoolClass } from "@/lib/types";

type PreviewRow = {
  studentId: string;
  name: string;
  admissionNumber: string;
  currentClass: string;
  level: string;
  academicStatus: string;
  average: number | null;
  position: number | null;
  recommendation: "PROMOTE" | "REPEAT" | "SKIP";
  reason: string;
  nextClassName: string | null;
  alreadyProcessed: boolean;
};

type PreviewData = {
  session: string;
  term: string;
  passAverage: number;
  students: PreviewRow[];
  summary: {
    total: number;
    promote: number;
    repeat: number;
    skip: number;
    alreadyProcessed: number;
  };
};

type ActionSummary = {
  message: string;
  summary: { promoted: number; repeating: number; skipped: number };
};

export default function PromotionPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [session, setSession] = useState("2025/2026");
  const [classId, setClassId] = useState("");
  const [data, setData] = useState<PreviewData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState<ActionSummary | null>(null);

  useEffect(() => {
    api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100")
      .then((res) => setClasses(res.data))
      .catch((err) => setError(formatApiError(err, "Failed to load classes")));
  }, []);

  async function loadPreview() {
    setLoading(true);
    setError("");
    setActionResult(null);
    try {
      const qs = new URLSearchParams({
        session,
        term: "THIRD",
        ...(classId ? { classId } : {}),
      });
      const res = await api<{ success: true; data: PreviewData }>(
        `/api/term/promotion-preview?${qs}`
      );
      setData(res.data);
      setSelected(new Set());
    } catch (err) {
      const msg = formatApiError(err, "Failed to load promotion preview");
      setError(msg);
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, classId]);

  const selectableIds = useMemo(
    () =>
      (data?.students ?? [])
        .filter((s) => !s.alreadyProcessed)
        .map((s) => s.studentId),
    [data]
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableIds));
  }

  function toggleOne(id: string, alreadyProcessed: boolean) {
    if (alreadyProcessed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAction(action: "promote" | "repeat" | "auto", studentIds: string[]) {
    if (studentIds.length === 0) {
      toast.error("Select at least one student");
      return;
    }

    const labels = {
      promote: `Promote ${studentIds.length} selected student(s)?`,
      repeat: `Mark ${studentIds.length} selected student(s) as repeating?`,
      auto: `Promote all eligible (${studentIds.length}) students with average ≥ 45%?`,
    };
    if (!confirm(labels[action])) return;

    setBusy(true);
    setError("");
    try {
      const res = await api<{ success: true; data: ActionSummary }>("/api/term/promote-selected", {
        method: "POST",
        body: JSON.stringify({
          session,
          term: "THIRD",
          studentIds,
          action,
        }),
      });
      setActionResult(res.data);
      toast.success(res.data.message);
      await loadPreview();
    } catch (err) {
      const msg = formatApiError(err, "Promotion action failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const eligibleIds =
    data?.students
      .filter((s) => s.recommendation === "PROMOTE" && !s.alreadyProcessed)
      .map((s) => s.studentId) ?? [];

  return (
    <AppShell title="Promotion">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Third-term promotion
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Preview and selectively promote or mark students repeating after THIRD term. Existing
          rule: cumulative average ≥ 45% recommends promotion; below 45% recommends repeat.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <Label>Session</Label>
            <Input value={session} onChange={(e) => setSession(e.target.value)} />
          </div>
          <div>
            <Label>Class (optional)</Label>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Term</Label>
            <Input value="THIRD" disabled />
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {data?.summary ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(
            [
              ["total", "Total"],
              ["promote", "Promote"],
              ["repeat", "Repeat"],
              ["skip", "Skip"],
              ["alreadyProcessed", "Already done"],
            ] as const
          ).map(([key, label]) => (
            <Card key={key} className="!p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                {data.summary[key]}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {actionResult ? (
        <Card className="mb-6 border-brand/40 bg-brand-soft/30">
          <p className="font-semibold text-brand">{actionResult.message}</p>
          <p className="mt-1 text-sm text-muted">
            Promoted {actionResult.summary.promoted} · Repeating {actionResult.summary.repeating} ·
            Skipped {actionResult.summary.skipped}
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Students
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pass average: {data?.passAverage ?? 45}% · {selected.size} selected
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={busy}
              disabled={busy || selected.size === 0}
              onClick={() => void runAction("promote", [...selected])}
            >
              Promote selected
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              disabled={busy || selected.size === 0}
              onClick={() => void runAction("repeat", [...selected])}
            >
              Mark selected repeating
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              disabled={busy || eligibleIds.length === 0}
              onClick={() => void runAction("auto", eligibleIds)}
            >
              Promote all eligible
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted">Loading preview…</p>
        ) : !data || data.students.length === 0 ? (
          <p className="text-muted">No students for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all eligible"
                    />
                  </th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Average</th>
                  <th className="py-2 pr-3">Pos</th>
                  <th className="py-2 pr-3">Current class</th>
                  <th className="py-2 pr-3">Recommendation</th>
                  <th className="py-2 pr-3">Next class</th>
                  <th className="py-2">Processed</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr
                    key={s.studentId}
                    className={`border-b border-line ${s.alreadyProcessed ? "opacity-60" : ""}`}
                  >
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={selected.has(s.studentId)}
                        disabled={s.alreadyProcessed}
                        onChange={() => toggleOne(s.studentId, s.alreadyProcessed)}
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                    <td className="py-3 pr-3 font-medium">
                      {s.name}
                      <span className="mt-0.5 block text-xs text-muted">{s.admissionNumber}</span>
                    </td>
                    <td className="py-3 pr-3">{s.average ?? "—"}</td>
                    <td className="py-3 pr-3">{s.position ?? "—"}</td>
                    <td className="py-3 pr-3">{s.currentClass}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.recommendation === "PROMOTE"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.recommendation === "REPEAT"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-line/60 text-muted"
                        }`}
                      >
                        {s.recommendation}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{s.reason}</span>
                    </td>
                    <td className="py-3 pr-3">{s.nextClassName ?? "—"}</td>
                    <td className="py-3">{s.alreadyProcessed ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
