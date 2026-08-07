"use client";

// Purpose: Score entry organized by class → subject → students.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Enrollment, SchoolClass, Score, Term } from "@/lib/types";

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

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
          `/api/scores?limit=100&classId=${classId}&session=${encodeURIComponent(session)}&term=${term}${
            subjectId ? `&subjectId=${subjectId}` : ""
          }`
        ),
      ]);
      setEnrollments(e.data);
      setScores(s.data);
      const next: Record<string, { assessment: string; exam: string }> = {};
      for (const en of e.data) {
        next[en.id] = {
          assessment: String(en.score?.assessment ?? 30),
          exam: String(en.score?.exam ?? 45),
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

  async function saveOne(enrollmentId: string) {
    const row = rows[enrollmentId];
    if (!row) return;
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
    }
  }

  async function saveAll(e: FormEvent) {
    e.preventDefault();
    if (!isTeacher) return;
    setBusy(true);
    try {
      for (const en of studentsForSubject) {
        const row = rows[en.id];
        if (!row) continue;
        await api("/api/scores", {
          method: "POST",
          body: JSON.stringify({
            enrollmentId: en.id,
            assessment: Number(row.assessment),
            exam: Number(row.exam),
          }),
        });
      }
      toast.success("All scores saved");
      await loadEnrollments();
    } catch (err) {
      const msg = formatApiError(err, "Bulk save failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Scores">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Enter scores by class
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(""); }}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Session</Label>
            <Input value={session} onChange={(e) => setSession(e.target.value)} />
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
          <div>
            <Label>Subject</Label>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select subject…</option>
              {subjectsInClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
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
          {subjectsInClass.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No enrollments found for this class/session/term.</p>
          ) : null}
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Students ({studentsForSubject.length})
            </h2>
            {isTeacher ? (
              <Button type="button" loading={busy} onClick={(e) => void saveAll(e as unknown as FormEvent)}>
                Save all
              </Button>
            ) : (
              <p className="text-sm text-muted">Teachers enter scores; admins can review the table below.</p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">CA (40)</th>
                  <th className="py-2 pr-3">Exam (60)</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {studentsForSubject.map((en) => (
                  <tr key={en.id} className="border-b border-line">
                    <td className="py-3 pr-3 font-medium">
                      {en.student.lastName}, {en.student.firstName}
                    </td>
                    <td className="py-3 pr-3">
                      <Input
                        type="number"
                        min={0}
                        max={40}
                        disabled={!isTeacher || busy}
                        value={rows[en.id]?.assessment ?? ""}
                        onChange={(e) =>
                          setRows((r) => ({
                            ...r,
                            [en.id]: { ...r[en.id], assessment: e.target.value, exam: r[en.id]?.exam ?? "" },
                          }))
                        }
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        disabled={!isTeacher || busy}
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
                      />
                    </td>
                    <td className="py-3 pr-3">{en.resultStatusLabel ?? (en.score ? "Graded" : "Awaiting")}</td>
                    <td className="py-3">
                      {isTeacher ? (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={busy}
                          onClick={() => void saveOne(en.id)}
                        >
                          Save
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
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
