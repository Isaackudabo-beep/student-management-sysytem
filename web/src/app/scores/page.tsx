"use client";

// Purpose: Fast teacher score entry by class → subject → students (bulk save + completion %).
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Enrollment, SchoolClass, Score, Term } from "@/lib/types";

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

function statusLabel(en: Enrollment) {
  const st = (en.score as (Score & { status?: string }) | null | undefined)?.status;
  if (!en.score) return "Missing";
  if (st === "RETURNED") return "Returned";
  if (st === "SUBMITTED") return "Submitted";
  if (st === "APPROVED") return "Approved";
  if (st === "PUBLISHED") return "Published";
  if (st === "DRAFT") return "Draft";
  return en.resultStatusLabel ?? "Graded";
}

export default function ScoresPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isTeacher = user?.role === "TEACHER";

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<Term>("FIRST");
  const [rows, setRows] = useState<Record<string, { assessment: string; exam: string }>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadMeta() {
    try {
      const c = await api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100");
      setClasses(c.data);
      if (!classId && c.data[0]) setClassId(c.data[0].id);
    } catch (err) {
      setError(formatApiError(err, "Failed to load classes"));
    }
  }

  async function loadEnrollments() {
    if (!classId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: "200",
        classId,
        session,
        term,
        ...(subjectId ? { subjectId } : {}),
      });
      const [e, s] = await Promise.all([
        api<{ success: true; data: Enrollment[] }>(`/api/enrollments?${qs}`),
        api<{ success: true; data: Score[] }>(
          `/api/scores?limit=200&classId=${classId}&session=${encodeURIComponent(session)}&term=${term}${
            subjectId ? `&subjectId=${subjectId}` : ""
          }`
        ),
      ]);
      setEnrollments(e.data);
      setScores(s.data);
      const next: Record<string, { assessment: string; exam: string }> = {};
      for (const en of e.data) {
        next[en.id] = {
          assessment: en.score ? String(en.score.assessment) : "",
          exam: en.score ? String(en.score.exam) : "",
        };
      }
      setRows(next);
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load scores"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId, session, term]);

  const subjectsInClass = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const e of enrollments) {
      map.set(e.subject.id, { id: e.subject.id, label: `${e.subject.code} — ${e.subject.title}` });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [enrollments]);

  const studentsForSubject = useMemo(() => {
    if (!subjectId) return [];
    return enrollments
      .filter((e) => e.subject.id === subjectId)
      .sort((a, b) =>
        `${a.student.lastName}${a.student.firstName}`.localeCompare(
          `${b.student.lastName}${b.student.firstName}`
        )
      );
  }, [enrollments, subjectId]);

  const completion = useMemo(() => {
    const total = studentsForSubject.length;
    const scored = studentsForSubject.filter((e) => e.score).length;
    const missing = total - scored;
    const percent = total ? Number(((scored / total) * 100).toFixed(0)) : 0;
    return { total, scored, missing, percent };
  }, [studentsForSubject]);

  function validateRow(assessment: string, exam: string) {
    const a = Number(assessment);
    const ex = Number(exam);
    if (assessment === "" || exam === "" || Number.isNaN(a) || Number.isNaN(ex)) {
      return "CA and Exam are required";
    }
    if (a < 0 || a > 40) return "CA must be 0–40";
    if (ex < 0 || ex > 60) return "Exam must be 0–60";
    return null;
  }

  function isLocked(en: Enrollment) {
    const st = (en.score as Score & { status?: string } | undefined)?.status;
    return st === "APPROVED" || st === "PUBLISHED";
  }

  async function saveOne(enrollmentId: string) {
    if (!isTeacher) return;
    const row = rows[enrollmentId];
    if (!row) return;
    const invalid = validateRow(row.assessment, row.exam);
    if (invalid) {
      setError(invalid);
      toast.error(invalid);
      return;
    }
    setSavingId(enrollmentId);
    setBusy(true);
    try {
      await api("/api/scores", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId,
          assessment: Number(row.assessment),
          exam: Number(row.exam),
        }),
      });
      toast.success("Score saved");
      await loadEnrollments();
    } catch (err) {
      const msg = formatApiError(err, "Save failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setSavingId(null);
    }
  }

  async function saveAll(e?: FormEvent, asDraft = false) {
    e?.preventDefault();
    if (!isTeacher) return;
    const payload = [];
    for (const en of studentsForSubject) {
      if (isLocked(en)) continue;
      const row = rows[en.id];
      if (!row || row.assessment === "" || row.exam === "") continue;
      const invalid = validateRow(row.assessment, row.exam);
      if (invalid) {
        setError(`${en.student.lastName}: ${invalid}`);
        toast.error(invalid);
        return;
      }
      payload.push({
        enrollmentId: en.id,
        assessment: Number(row.assessment),
        exam: Number(row.exam),
      });
    }
    if (payload.length === 0) {
      toast.error("No editable scores to save");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{
        success: true;
        data: { message: string; saved: number; failed: number };
      }>("/api/scores/bulk", {
        method: "POST",
        body: JSON.stringify({ scores: payload, asDraft }),
      });
      if (res.data.failed > 0) toast.error(res.data.message);
      else toast.success(res.data.message);
      await loadEnrollments();
    } catch (err) {
      const msg = formatApiError(err, "Bulk save failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function onKeyNav(e: KeyboardEvent<HTMLInputElement>, enrollmentId: string, field: "assessment" | "exam") {
    if (e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const idx = studentsForSubject.findIndex((s) => s.id === enrollmentId);
    if (idx < 0) return;
    const nextIdx = e.key === "ArrowUp" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= studentsForSubject.length) return;
    const nextId = studentsForSubject[nextIdx].id;
    const el = document.querySelector<HTMLInputElement>(
      `input[data-score-field="${nextId}:${field}"]`
    );
    el?.focus();
    el?.select();
  }

  return (
    <AppShell title="Scores">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Enter scores by class
        </h2>
        <p className="mt-1 text-sm text-muted">
          Teachers save for assigned subjects only. Approved/published scores are locked until an admin
          returns them.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Class</Label>
            {classes.length === 0 ? (
              <p className="text-sm text-muted">No classes available.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {classes.map((c) => {
                  const active = classId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClassId(c.id);
                        setSubjectId("");
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-white text-ink hover:border-brand/50"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <Label>Session</Label>
            <Input
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="2025/2026"
            />
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
          <div className="md:col-span-4">
            <Label>Subject</Label>
            {subjectsInClass.length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                {classId
                  ? "No enrolled subjects for this class/session/term yet."
                  : "Choose a class first."}
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2">
                {subjectsInClass.map((s) => {
                  const active = subjectId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubjectId(s.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-white text-ink hover:border-brand/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Card>
          <p className="text-muted">Loading enrollments…</p>
        </Card>
      ) : !subjectId ? (
        <Card>
          <p className="text-muted">Select a class and subject to enter scores.</p>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Students ({completion.total})
              </h2>
              <p className="mt-1 text-sm text-muted">
                Completion: <strong>{completion.percent}%</strong> · {completion.scored} scored ·{" "}
                {completion.missing} missing
              </p>
              <div className="mt-2 h-2 w-48 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </div>
            {isTeacher ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void saveAll(undefined, true)}
                >
                  Save drafts
                </Button>
                <Button
                  type="button"
                  loading={busy}
                  disabled={busy}
                  onClick={(e) => void saveAll(e as unknown as FormEvent)}
                >
                  Save all
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Admin review — use <a className="underline" href="/results-review">Results review</a> to
                approve/publish.
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">CA (40)</th>
                  <th className="py-2 pr-3">Exam (60)</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {studentsForSubject.map((en) => {
                  const locked = isLocked(en);
                  const a = Number(rows[en.id]?.assessment);
                  const ex = Number(rows[en.id]?.exam);
                  const previewTotal =
                    rows[en.id]?.assessment !== "" &&
                    rows[en.id]?.exam !== "" &&
                    !Number.isNaN(a) &&
                    !Number.isNaN(ex)
                      ? (a + ex).toFixed(1)
                      : en.score?.total ?? "—";
                  const returned = (en.score as { returnNote?: string } | undefined)?.returnNote;
                  return (
                    <tr
                      key={en.id}
                      className={`border-b border-line ${!en.score ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="py-3 pr-3 font-medium">
                        {en.student.lastName}, {en.student.firstName}
                        {returned ? (
                          <p className="mt-1 text-xs font-normal text-danger">Return note: {returned}</p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">
                        <Input
                          type="number"
                          min={0}
                          max={40}
                          data-score-field={`${en.id}:assessment`}
                          disabled={!isTeacher || busy || locked}
                          value={rows[en.id]?.assessment ?? ""}
                          onChange={(e) =>
                            setRows((r) => ({
                              ...r,
                              [en.id]: {
                                ...r[en.id],
                                assessment: e.target.value,
                                exam: r[en.id]?.exam ?? "",
                              },
                            }))
                          }
                          onKeyDown={(e) => onKeyNav(e, en.id, "assessment")}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          data-score-field={`${en.id}:exam`}
                          disabled={!isTeacher || busy || locked}
                          value={rows[en.id]?.exam ?? ""}
                          onChange={(e) =>
                            setRows((r) => ({
                              ...r,
                              [en.id]: {
                                ...r[en.id],
                                exam: e.target.value,
                                assessment: r[en.id]?.assessment ?? "",
                              },
                            }))
                          }
                          onKeyDown={(e) => onKeyNav(e, en.id, "exam")}
                        />
                      </td>
                      <td className="py-3 pr-3 font-semibold">{previewTotal}</td>
                      <td className="py-3 pr-3">{statusLabel(en)}</td>
                      <td className="py-3">
                        {isTeacher && !locked ? (
                          <Button
                            type="button"
                            variant="secondary"
                            loading={savingId === en.id}
                            disabled={busy}
                            onClick={() => void saveOne(en.id)}
                          >
                            Save
                          </Button>
                        ) : locked ? (
                          <span className="text-xs text-muted">Locked</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Recent scores</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {scores.slice(0, 20).map((s) => (
            <li key={s.id} className="flex justify-between border-b border-line py-2">
              <span>
                {s.enrollment?.student?.firstName} {s.enrollment?.student?.lastName} ·{" "}
                {s.enrollment?.subject?.code}
                {(s as Score & { status?: string }).status
                  ? ` · ${(s as Score & { status?: string }).status}`
                  : ""}
              </span>
              <span className="font-semibold">
                {s.total} ({s.grade})
              </span>
            </li>
          ))}
          {scores.length === 0 ? <li className="text-muted">No scores yet</li> : null}
        </ul>
      </Card>
    </AppShell>
  );
}
