"use client";

// Purpose: Staff report-card viewer with printable layout and editable comments.
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { schoolBrandName, useAuth } from "@/lib/auth";
import type { SchoolClass, Student, Term } from "@/lib/types";

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

type ReportCardData = {
  school: {
    name: string;
    code: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  student: {
    id: string;
    fullName: string;
    admissionNumber: string;
    className: string;
    level: string;
    department: string;
    academicStatusLabel?: string;
  };
  session: string;
  term: Term;
  subjects: Array<{
    code: string;
    title: string;
    assessment: number | null;
    exam: number | null;
    total: number | null;
    grade: string | null;
    remark: string | null;
    resultStatusLabel?: string;
  }>;
  summary: {
    enrolled: number;
    graded: number;
    awaiting: number;
    average: number | null;
    position: number | null;
    promotionHint?: string | null;
  };
  comments: {
    teacherComment: string | null;
    principalComment: string | null;
  };
};

export default function ReportCardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER";

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<Term>("FIRST");
  const [data, setData] = useState<ReportCardData | null>(null);
  const [teacherComment, setTeacherComment] = useState("");
  const [principalComment, setPrincipalComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState<"color" | "bw">("color");

  useEffect(() => {
    api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100")
      .then((res) => {
        setClasses(res.data);
        if (res.data[0]) setClassId(res.data[0].id);
      })
      .catch((err) => setError(formatApiError(err, "Failed to load classes")));
  }, []);

  useEffect(() => {
    if (!classId) return;
    setStudentId("");
    setData(null);
    api<{ success: true; data: Student[] }>(`/api/students?classId=${classId}&limit=200`)
      .then((res) => {
        setStudents(res.data);
        if (res.data[0]) setStudentId(res.data[0].id);
      })
      .catch((err) => setError(formatApiError(err, "Failed to load students")));
  }, [classId]);

  async function loadCard() {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ session, term });
      const res = await api<{ success: true; data: ReportCardData }>(
        `/api/scores/report-card/${studentId}?${qs}`
      );
      setData(res.data);
      setTeacherComment(res.data.comments.teacherComment ?? "");
      setPrincipalComment(res.data.comments.principalComment ?? "");
    } catch (err) {
      const msg = formatApiError(err, "Failed to load report card");
      setError(msg);
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (studentId) void loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, session, term]);

  async function saveComments() {
    if (!studentId) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        studentId,
        session,
        term,
        teacherComment: teacherComment || null,
      };
      if (isAdmin) body.principalComment = principalComment || null;
      await api("/api/scores/comments", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      toast.success("Comments saved");
      await loadCard();
    } catch (err) {
      const msg = formatApiError(err, "Failed to save comments");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function printReport(mode: "color" | "bw") {
    setPrintMode(mode);
    document.body.dataset.printMode = mode;
    window.print();
    window.setTimeout(() => {
      delete document.body.dataset.printMode;
    }, 500);
  }

  return (
    <AppShell title="Report card">
      <Card className="mb-6 no-print">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Staff report card
        </h2>
        <p className="mt-1 text-sm text-muted">
          View and print term report cards. Students should use{" "}
          <Link href="/results" className="font-semibold text-brand underline">
            My Results
          </Link>{" "}
          for their own published slip.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label>Class</Label>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Student</Label>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.length === 0 ? (
                <option value="">No students</option>
              ) : (
                students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName}, {s.firstName}
                  </option>
                ))
              )}
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
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => printReport("color")}
            disabled={!data}
          >
            Print colour
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => printReport("bw")}
            disabled={!data}
          >
            Print B&amp;W
          </Button>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Card>
          <p className="text-muted">Loading report card…</p>
        </Card>
      ) : !data ? (
        <Card>
          <p className="text-muted">Select a student to view their report card.</p>
        </Card>
      ) : (
        <>
          <div className="print-report overflow-hidden rounded-3xl border border-line bg-bg-elevated shadow-[var(--shadow)]">
            <div
              className={`px-6 py-6 sm:px-8 ${
                printMode === "bw" ? "bg-ink text-white" : "bg-brand text-white"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                {data.school.name || schoolBrandName(user)} · {data.school.code}
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
                Term Report Card
              </h2>
              <p className="mt-2 text-sm text-white/85">
                {data.session} · {data.term} · Issued {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="grid gap-4 border-b border-line px-6 py-5 sm:grid-cols-2 sm:px-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Student</p>
                <p className="mt-1 text-lg font-semibold">{data.student.fullName}</p>
                <p className="text-sm text-muted">
                  Admission {data.student.admissionNumber}
                  {data.student.academicStatusLabel
                    ? ` · ${data.student.academicStatusLabel}`
                    : ""}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wide text-muted">Class</p>
                <p className="mt-1 text-lg font-semibold">{data.student.className}</p>
                <p className="text-sm text-muted">
                  {data.student.level} · {data.student.department}
                </p>
              </div>
            </div>

            <div className="grid gap-3 border-b border-line px-6 py-5 sm:grid-cols-4 sm:px-8">
              {[
                ["Subjects", data.summary.enrolled],
                ["Graded", data.summary.graded],
                ["Average", data.summary.average ?? "—"],
                ["Position", data.summary.position ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-brand-soft px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {data.summary.promotionHint ? (
              <p className="border-b border-line px-6 py-3 text-sm text-muted sm:px-8">
                {data.summary.promotionHint}
              </p>
            ) : null}

            <div className="overflow-x-auto px-2 py-4 sm:px-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">CA</th>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted" colSpan={6}>
                        No subjects for this session/term.
                      </td>
                    </tr>
                  ) : (
                    data.subjects.map((s) => (
                      <tr key={s.code} className="border-b border-line/70">
                        <td className="px-4 py-3 font-medium">
                          {s.code} — {s.title}
                        </td>
                        <td className="px-4 py-3">{s.assessment ?? "—"}</td>
                        <td className="px-4 py-3">{s.exam ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold">{s.total ?? "—"}</td>
                        <td className="px-4 py-3">{s.grade ?? "—"}</td>
                        <td className="px-4 py-3">{s.remark ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 border-t border-line px-6 py-5 sm:grid-cols-2 sm:px-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Teacher&apos;s comment</p>
                <p className="mt-2 min-h-[3rem] text-sm whitespace-pre-wrap">
                  {data.comments.teacherComment || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Principal&apos;s comment</p>
                <p className="mt-2 min-h-[3rem] text-sm whitespace-pre-wrap">
                  {data.comments.principalComment || "—"}
                </p>
              </div>
            </div>
          </div>

          {(isAdmin || isTeacher) && (
            <Card className="mt-6 no-print">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Edit comments
              </h2>
              <div className="mt-4 grid gap-4">
                <div>
                  <Label>Teacher comment</Label>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
                    value={teacherComment}
                    onChange={(e) => setTeacherComment(e.target.value)}
                    maxLength={1000}
                  />
                </div>
                {isAdmin ? (
                  <div>
                    <Label>Principal comment</Label>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
                      value={principalComment}
                      onChange={(e) => setPrincipalComment(e.target.value)}
                      maxLength={1000}
                    />
                  </div>
                ) : null}
                <div>
                  <Button type="button" loading={saving} disabled={saving} onClick={() => void saveComments()}>
                    Save comments
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
