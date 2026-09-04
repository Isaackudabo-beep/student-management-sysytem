"use client";

// Purpose: Admin/teacher result sheet review — approve, publish, or return scores.
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SchoolClass, SheetStatus, Term } from "@/lib/types";

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

type ReviewCounts = {
  pending: number;
  incomplete: number;
  review: number;
  approved: number;
  published: number;
  returned: number;
};

type ReviewSheet = {
  classId: string;
  className: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  session: string;
  term: Term;
  enrolled: number;
  scored: number;
  missing: number;
  completionPercent: number;
  status: SheetStatus;
};

type SheetRow = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  assessment: number | null;
  exam: number | null;
  total: number | null;
  grade: string | null;
  remark: string | null;
  status: string | null;
  returnNote: string | null;
  teacherName: string | null;
};

type SheetDetail = {
  classId: string;
  className: string;
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
  session: string;
  term: Term;
  status: SheetStatus;
  enrolled: number;
  scored: number;
  missing: number;
  rows: SheetRow[];
};

function statusChip(status: SheetStatus | string) {
  const styles: Record<string, string> = {
    PENDING: "bg-line/60 text-muted",
    INCOMPLETE: "bg-amber-100 text-amber-900",
    REVIEW: "bg-brand-soft text-brand",
    APPROVED: "bg-emerald-100 text-emerald-800",
    PUBLISHED: "bg-brand text-white",
    RETURNED: "bg-red-100 text-danger",
  };
  return styles[status] ?? "bg-line/60 text-muted";
}

export default function ResultsReviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "ADMIN";

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<Term>("FIRST");
  const [classId, setClassId] = useState("");
  const [counts, setCounts] = useState<ReviewCounts | null>(null);
  const [sheets, setSheets] = useState<ReviewSheet[]>([]);
  const [selected, setSelected] = useState<ReviewSheet | null>(null);
  const [detail, setDetail] = useState<SheetDetail | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100")
      .then((res) => setClasses(res.data))
      .catch((err) => setError(formatApiError(err, "Failed to load classes")));
  }, []);

  async function loadReview() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        session,
        term,
        ...(classId ? { classId } : {}),
      });
      const res = await api<{
        success: true;
        data: { counts: ReviewCounts; sheets: ReviewSheet[] };
      }>(`/api/scores/review?${qs}`);
      setCounts(res.data.counts);
      setSheets(res.data.sheets);
      if (selected) {
        const still = res.data.sheets.find(
          (s) => s.classId === selected.classId && s.subjectId === selected.subjectId
        );
        if (!still) {
          setSelected(null);
          setDetail(null);
        }
      }
    } catch (err) {
      const msg = formatApiError(err, "Failed to load review sheets");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, term, classId]);

  async function openSheet(sheet: ReviewSheet) {
    setSelected(sheet);
    setDetailLoading(true);
    setReturnNote("");
    setError("");
    try {
      const qs = new URLSearchParams({
        classId: sheet.classId,
        subjectId: sheet.subjectId,
        session: sheet.session,
        term: sheet.term,
      });
      const res = await api<{ success: true; data: SheetDetail }>(`/api/scores/sheet?${qs}`);
      setDetail(res.data);
    } catch (err) {
      const msg = formatApiError(err, "Failed to load sheet");
      setError(msg);
      toast.error(msg);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(action: "approve" | "publish" | "return") {
    if (!selected || !isAdmin) return;
    if (action === "publish" && !confirm("Publish this sheet? Students will see the results.")) {
      return;
    }
    if (action === "return") {
      if (!returnNote.trim()) {
        toast.error("Return note is required");
        return;
      }
      if (!confirm("Return this sheet to teachers for correction?")) return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await api<{ success: true; data: { message: string } }>(
        `/api/scores/${action}`,
        {
          method: "POST",
          body: JSON.stringify({
            classId: selected.classId,
            subjectId: selected.subjectId,
            session: selected.session,
            term: selected.term,
            ...(action === "return" ? { returnNote: returnNote.trim() } : {}),
          }),
        }
      );
      toast.success(res.data.message);
      setReturnNote("");
      await loadReview();
      await openSheet(selected);
    } catch (err) {
      const msg = formatApiError(err, `${action} failed`);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Results review">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Result approval
        </h2>
        <p className="mt-1 text-sm text-muted">
          {isAdmin
            ? "Review submitted sheets, approve, publish to students, or return with a note."
            : "View sheets for your subjects. Only admins can approve, publish, or return."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label>Session</Label>
            <Input value={session} onChange={(e) => setSession(e.target.value)} placeholder="2025/2026" />
          </div>
          <div>
            <Label>Term</Label>
            <Select value={term} onChange={(e) => setTerm(e.target.value as Term)}>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
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
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {counts ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ["pending", "Pending"],
              ["incomplete", "Incomplete"],
              ["review", "Review"],
              ["approved", "Approved"],
              ["published", "Published"],
              ["returned", "Returned"],
            ] as const
          ).map(([key, label]) => (
            <Card key={key} className="!p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                {counts[key]}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Sheets
          </h2>
          {loading ? (
            <p className="mt-4 text-muted">Loading sheets…</p>
          ) : sheets.length === 0 ? (
            <p className="mt-4 text-muted">No result sheets for this filter.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 pr-3">Class</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Enrolled</th>
                    <th className="py-2 pr-3">Scored</th>
                    <th className="py-2 pr-3">Missing</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((s) => {
                    const active =
                      selected?.classId === s.classId && selected?.subjectId === s.subjectId;
                    return (
                      <tr
                        key={`${s.classId}:${s.subjectId}`}
                        className={`cursor-pointer border-b border-line transition hover:bg-brand-soft/50 ${
                          active ? "bg-brand-soft/70" : ""
                        }`}
                        onClick={() => void openSheet(s)}
                      >
                        <td className="py-3 pr-3 font-medium">{s.className}</td>
                        <td className="py-3 pr-3">
                          {s.subjectCode}
                          <span className="mt-0.5 block text-xs text-muted">{s.subjectTitle}</span>
                        </td>
                        <td className="py-3 pr-3">{s.enrolled}</td>
                        <td className="py-3 pr-3">{s.scored}</td>
                        <td className="py-3 pr-3">{s.missing}</td>
                        <td className="py-3 pr-3">{s.completionPercent}%</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(s.status)}`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Sheet detail
          </h2>
          {!selected ? (
            <p className="mt-4 text-muted">Select a sheet to review scores.</p>
          ) : detailLoading ? (
            <p className="mt-4 text-muted">Loading sheet…</p>
          ) : !detail ? (
            <p className="mt-4 text-muted">Unable to load sheet detail.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">
                {detail.className} · {detail.subjectCode} — {detail.subjectTitle} · {detail.session}{" "}
                {detail.term}
              </p>
              <p className="mt-1 text-sm">
                Status:{" "}
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(detail.status)}`}
                >
                  {detail.status}
                </span>{" "}
                · {detail.scored}/{detail.enrolled} scored · {detail.missing} missing
              </p>

              {isAdmin ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void runAction("approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void runAction("publish")}
                    >
                      Publish
                    </Button>
                  </div>
                  <div>
                    <Label>Return note</Label>
                    <Input
                      value={returnNote}
                      onChange={(e) => setReturnNote(e.target.value)}
                      placeholder="Required when returning for correction"
                    />
                    <Button
                      type="button"
                      variant="danger"
                      className="mt-2"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void runAction("return")}
                    >
                      Return
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">View only — ask an admin to approve or publish.</p>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">CA</th>
                      <th className="py-2 pr-3">Exam</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Grade</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rows.map((r) => (
                      <tr key={r.enrollmentId} className="border-b border-line">
                        <td className="py-2 pr-3 font-medium">
                          {r.studentName}
                          {r.returnNote ? (
                            <p className="mt-0.5 text-xs font-normal text-danger">{r.returnNote}</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">{r.assessment ?? "—"}</td>
                        <td className="py-2 pr-3">{r.exam ?? "—"}</td>
                        <td className="py-2 pr-3 font-semibold">{r.total ?? "—"}</td>
                        <td className="py-2 pr-3">{r.grade ?? "—"}</td>
                        <td className="py-2">{r.status ?? "Missing"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
