"use client";

// Purpose: Class broadsheet — subject columns, totals, average, grade, position + print.
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { schoolBrandName, useAuth } from "@/lib/auth";
import type { SchoolClass, SheetStatus, Term } from "@/lib/types";

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

type BroadsheetCell = {
  total: number | null;
  grade: string | null;
  status: string | null;
};

type BroadsheetStudent = {
  studentId: string;
  name: string;
  admissionNumber: string;
  cells: Record<string, BroadsheetCell>;
  total: number | null;
  average: number | null;
  grade: string | null;
  position: number | null;
};

type BroadsheetData = {
  schoolName: string;
  className: string;
  session: string;
  term: Term;
  subjects: Array<{ id: string; code: string; title: string }>;
  subjectStatuses: Array<{ subjectId: string; status: SheetStatus }>;
  students: BroadsheetStudent[];
};

function statusChip(status: SheetStatus) {
  if (status === "INCOMPLETE" || status === "PENDING") {
    return "bg-amber-100 text-amber-900";
  }
  if (status === "RETURNED") return "bg-red-100 text-danger";
  if (status === "PUBLISHED") return "bg-brand text-white";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  return "bg-brand-soft text-brand";
}

export default function BroadsheetPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<Term>("FIRST");
  const [classId, setClassId] = useState("");
  const [data, setData] = useState<BroadsheetData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100")
      .then((res) => {
        setClasses(res.data);
        if (res.data[0]) setClassId(res.data[0].id);
      })
      .catch((err) => setError(formatApiError(err, "Failed to load classes")));
  }, []);

  async function load() {
    if (!classId) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ session, term, classId });
      const res = await api<{ success: true; data: BroadsheetData }>(
        `/api/scores/broadsheet?${qs}`
      );
      setData(res.data);
    } catch (err) {
      const msg = formatApiError(err, "Failed to load broadsheet");
      setError(msg);
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (classId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, term, classId]);

  const incompleteSubjects =
    data?.subjectStatuses.filter(
      (s) => s.status === "INCOMPLETE" || s.status === "PENDING" || s.status === "RETURNED"
    ) ?? [];

  return (
    <AppShell title="Broadsheet">
      <Card className="mb-6 no-print">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Class broadsheet
        </h2>
        <p className="mt-1 text-sm text-muted">
          Subject totals per student with class average, grade, and position.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
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
            <Label>Class</Label>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Card>
          <p className="text-muted">Loading broadsheet…</p>
        </Card>
      ) : !data ? (
        <Card>
          <p className="text-muted">Select session, term, and class to view the broadsheet.</p>
        </Card>
      ) : (
        <div className="print-report overflow-hidden rounded-3xl border border-line bg-bg-elevated shadow-[var(--shadow)]">
          <div className="border-b border-line px-6 py-5 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              {data.schoolName || schoolBrandName(user)}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
              Broadsheet — {data.className}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {data.session} · {data.term}
            </p>
            {incompleteSubjects.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {incompleteSubjects.map((s) => {
                  const sub = data.subjects.find((x) => x.id === s.subjectId);
                  return (
                    <span
                      key={s.subjectId}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(s.status)}`}
                    >
                      {sub?.code ?? "Subject"}: {s.status}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto px-2 py-4 sm:px-4">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="sticky left-0 z-10 bg-bg-elevated px-3 py-3">Student</th>
                  {data.subjects.map((sub) => (
                    <th key={sub.id} className="px-3 py-3 whitespace-nowrap" title={sub.title}>
                      {sub.code}
                    </th>
                  ))}
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Average</th>
                  <th className="px-3 py-3">Grade</th>
                  <th className="px-3 py-3">Pos</th>
                </tr>
              </thead>
              <tbody>
                {data.students.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-muted"
                      colSpan={data.subjects.length + 5}
                    >
                      No students in this class.
                    </td>
                  </tr>
                ) : (
                  data.students.map((st) => (
                    <tr key={st.studentId} className="border-b border-line/70">
                      <td className="sticky left-0 z-10 bg-bg-elevated px-3 py-2.5 font-medium whitespace-nowrap">
                        {st.name}
                      </td>
                      {data.subjects.map((sub) => {
                        const cell = st.cells[sub.id];
                        return (
                          <td key={sub.id} className="px-3 py-2.5">
                            {cell?.total ?? "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 font-semibold">{st.total ?? "—"}</td>
                      <td className="px-3 py-2.5">{st.average ?? "—"}</td>
                      <td className="px-3 py-2.5">{st.grade ?? "—"}</td>
                      <td className="px-3 py-2.5">{st.position ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
