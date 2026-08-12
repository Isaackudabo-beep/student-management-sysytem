"use client";

// Purpose: Student results report — designed slip with save-on-device / print actions.
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Select } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { schoolBrandName, useAuth } from "@/lib/auth";

type ResultRow = {
  id: string;
  session: string;
  subject: { code: string; title: string };
  score?: {
    assessment: number;
    exam: number;
    total: number;
    grade: string;
    remark: string;
  } | null;
  resultStatusLabel?: string;
};

type ResultsPayload = {
  student: {
    fullName: string;
    admissionNumber: string;
    className: string;
    level: string;
    department: string;
  };
  sessions: string[];
  enrollments: ResultRow[];
  summary: { enrolled: number; graded: number; awaiting?: number; average: number | null };
};

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default function ResultsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [printMode, setPrintMode] = useState<"color" | "bw">("color");
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.studentId) return;
    api<{ success: true; data: ResultsPayload }>(`/api/scores/results/${user.studentId}`)
      .then((res) => {
        setData(res.data);
        setSessionFilter(res.data.sessions[0] ?? "");
      })
      .catch((err) => setError(formatApiError(err, "Failed to load results")));
  }, [user]);

  const rows = useMemo(() => {
    if (!data) return [];
    return sessionFilter
      ? data.enrollments.filter((e) => e.session === sessionFilter)
      : data.enrollments;
  }, [data, sessionFilter]);

  const summary = useMemo(() => {
    const graded = rows.filter((e) => e.score);
    const average =
      graded.length > 0
        ? Number(
            (graded.reduce((sum, e) => sum + (e.score?.total ?? 0), 0) / graded.length).toFixed(2)
          )
        : null;
    return {
      enrolled: rows.length,
      graded: graded.length,
      awaiting: rows.length - graded.length,
      average,
    };
  }, [rows]);

  function saveHtmlToDevice() {
    if (!data) return;
    const generated = new Date().toLocaleString();
    const tableRows = rows
      .map((e) => {
        const status = e.resultStatusLabel ?? (e.score ? "Graded" : "Awaiting Result");
        return `<tr>
          <td>${escapeHtml(e.subject.code)} — ${escapeHtml(e.subject.title)}</td>
          <td>${escapeHtml(e.session)}</td>
          <td>${e.score?.assessment ?? "—"}</td>
          <td>${e.score?.exam ?? "—"}</td>
          <td>${e.score?.total ?? "—"}</td>
          <td>${e.score?.grade ?? "—"}</td>
          <td>${escapeHtml(e.score?.remark ?? "—")}</td>
          <td>${escapeHtml(status)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Result Slip — ${escapeHtml(data.student.fullName)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #14212b; margin: 32px; }
    h1 { color: #0f4c5c; margin-bottom: 4px; }
    .meta { color: #5b6b78; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d7e0e7; padding: 10px 12px; text-align: left; font-size: 14px; }
    th { background: #e6f2f4; }
    .summary { display: flex; gap: 24px; margin: 20px 0; flex-wrap: wrap; }
    .pill { background: #e6f2f4; padding: 10px 14px; border-radius: 12px; }
  </style>
</head>
<body>
  <h1>Student Result Slip</h1>
  <p class="meta">Generated ${escapeHtml(generated)}</p>
  <p><strong>${escapeHtml(data.student.fullName)}</strong><br/>
  Admission: ${escapeHtml(data.student.admissionNumber)} · Class: ${escapeHtml(data.student.className)} ·
  ${escapeHtml(data.student.department)}</p>
  <div class="summary">
    <div class="pill">Subjects: ${summary.enrolled}</div>
    <div class="pill">Graded: ${summary.graded}</div>
    <div class="pill">Awaiting: ${summary.awaiting}</div>
    <div class="pill">Average: ${summary.average ?? "—"}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Subject</th><th>Session</th><th>CA</th><th>Exam</th>
        <th>Total</th><th>Grade</th><th>Remark</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

    const safeName = data.student.admissionNumber.replaceAll(/[^\w.-]+/g, "_");
    downloadBlob(`results-${safeName}.html`, html, "text/html;charset=utf-8");
    setSavedNote("Result slip saved to your device (HTML). Open it anytime or print to PDF.");
  }

  function saveCsvToDevice() {
    if (!data) return;
    const header = ["Subject", "Code", "Session", "CA", "Exam", "Total", "Grade", "Remark", "Status"];
    const lines = [
      header.join(","),
      ...rows.map((e) =>
        [
          `"${e.subject.title.replaceAll('"', '""')}"`,
          e.subject.code,
          e.session,
          e.score?.assessment ?? "",
          e.score?.exam ?? "",
          e.score?.total ?? "",
          e.score?.grade ?? "",
          `"${(e.score?.remark ?? "").replaceAll('"', '""')}"`,
          e.resultStatusLabel ?? (e.score ? "Graded" : "Awaiting Result"),
        ].join(",")
      ),
    ];
    const safeName = data.student.admissionNumber.replaceAll(/[^\w.-]+/g, "_");
    downloadBlob(`results-${safeName}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
    setSavedNote("CSV saved to your device.");
  }

  function printReport(mode: "color" | "bw" = printMode) {
    document.body.dataset.printMode = mode;
    window.print();
    window.setTimeout(() => {
      delete document.body.dataset.printMode;
    }, 500);
    setSavedNote(
      mode === "bw"
        ? "Printing in black & white. Use Save as PDF in the print dialog if needed."
        : "Printing in colour. Use Save as PDF in the print dialog if needed."
    );
  }

  return (
    <AppShell title="My Results">
      <ErrorText>{error}</ErrorText>

      {!data ? (
        <p className="text-muted">Loading results…</p>
      ) : (
        <>
          <Card className="mb-6 no-print">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-[200px]">
                <p className="mb-1 text-sm font-medium">Session</p>
                <Select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
                  <option value="">All sessions</option>
                  {data.sessions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveHtmlToDevice}>
                  Save on device
                </Button>
                <Button type="button" variant="secondary" onClick={saveCsvToDevice}>
                  Save CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPrintMode("color");
                    printReport("color");
                  }}
                >
                  Print colour
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPrintMode("bw");
                    printReport("bw");
                  }}
                >
                  Print B&amp;W
                </Button>
              </div>
            </div>
            {savedNote ? <p className="mt-3 text-sm text-success">{savedNote}</p> : null}
            <p className="mt-2 text-sm text-muted">
              Save on device downloads your result slip as a file you can keep offline. Print / Save
              as PDF opens the browser print dialog.
            </p>
          </Card>

          <div
            ref={reportRef}
            className="print-report overflow-hidden rounded-3xl border border-line bg-bg-elevated shadow-[var(--shadow)]"
          >
            <div className="bg-brand px-6 py-6 text-white sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                {schoolBrandName(user)} · Academic Report
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
                Result Slip
              </h2>
              <p className="mt-2 text-sm text-white/85">
                {sessionFilter || "All sessions"} · Issued {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="grid gap-4 border-b border-line px-6 py-5 sm:grid-cols-2 sm:px-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Student</p>
                <p className="mt-1 text-lg font-semibold">{data.student.fullName}</p>
                <p className="text-sm text-muted">
                  Admission {data.student.admissionNumber}
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
                ["Subjects", summary.enrolled],
                ["Graded", summary.graded],
                ["Awaiting", summary.awaiting],
                ["Average", summary.average ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-brand-soft px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto px-2 py-4 sm:px-4">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">CA</th>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Remark</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-muted" colSpan={8}>
                        No subjects for this session. After a term is closed, wait for new
                        enrollments.
                      </td>
                    </tr>
                  ) : (
                    rows.map((e) => (
                      <tr key={e.id} className="border-b border-line/70">
                        <td className="px-4 py-3 font-medium">
                          {e.subject.code} — {e.subject.title}
                        </td>
                        <td className="px-4 py-3">{e.session}</td>
                        <td className="px-4 py-3">{e.score?.assessment ?? "—"}</td>
                        <td className="px-4 py-3">{e.score?.exam ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold">{e.score?.total ?? "—"}</td>
                        <td className="px-4 py-3">{e.score?.grade ?? "—"}</td>
                        <td className="px-4 py-3">{e.score?.remark ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              e.score
                                ? "rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                                : "rounded-full bg-line/60 px-2.5 py-1 text-xs font-semibold text-muted"
                            }
                          >
                            {e.resultStatusLabel ?? (e.score ? "Graded" : "Awaiting Result")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line px-6 py-4 text-xs text-muted sm:px-8">
              Official school copy for the student portal. Grades are calculated on the server from
              Continuous Assessment (40) and Examination (60).
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
