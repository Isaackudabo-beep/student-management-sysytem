"use client";

// Purpose: Admin close-term tool — clears student scores/enrollments for a session; keeps teacher assignments.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";

type SessionRow = {
  session: string;
  enrollments: number;
  scores: number;
  teacherAssignments: number;
};

export default function TermPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [session, setSession] = useState("2025/2026");
  const [clearEnrollments, setClearEnrollments] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api<{ success: true; data: SessionRow[] }>("/api/term/sessions");
      setSessions(res.data);
      if (res.data[0]?.session) {
        setSession((s) => s || res.data[0].session);
      }
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load sessions"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = sessions.find((s) => s.session === session);

  async function onClose(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const action = clearEnrollments
      ? `Close term ${session}? This will delete all scores and enrollments for that session. Teacher subject assignments will NOT be changed.`
      : `Close term ${session}? This will delete all scores for that session (subjects stay as Awaiting Result). Teacher subject assignments will NOT be changed.`;

    if (!confirm(action)) return;

    setBusy(true);
    try {
      const res = await api<{ success: true; data: { message: string; teacherAssignmentsPreserved: number } }>(
        "/api/term/close",
        {
          method: "POST",
          body: JSON.stringify({ session, clearEnrollments }),
        }
      );
      setMessage(
        `${res.data.message} (${res.data.teacherAssignmentsPreserved} teacher assignment(s) kept).`
      );
      await load();
    } catch (err) {
      setError(formatApiError(err, "Close term failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Close Term">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          End-of-term reset
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Use this at the end of a session to clear the student portal for that term. Scores (and
          optionally enrollments) are removed. <strong>Assigned teachers stay assigned</strong> to
          their subjects for that session.
        </p>

        <form onSubmit={onClose} className="mt-6 grid max-w-xl gap-4">
          <div>
            <Label>Session to close</Label>
            {sessions.length > 0 ? (
              <Select value={session} onChange={(e) => setSession(e.target.value)} required>
                {sessions.map((s) => (
                  <option key={s.session} value={s.session}>
                    {s.session} — {s.scores} scores, {s.enrollments} enrollments,{" "}
                    {s.teacherAssignments} teacher assignments
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={session}
                onChange={(e) => setSession(e.target.value)}
                placeholder="2025/2026"
                required
              />
            )}
          </div>

          {selected ? (
            <div className="rounded-2xl border border-line bg-brand-soft/40 px-4 py-3 text-sm">
              <p>
                <span className="font-semibold">{selected.session}</span>
              </p>
              <p className="mt-1 text-muted">
                {selected.scores} score(s) · {selected.enrollments} enrollment(s) ·{" "}
                {selected.teacherAssignments} teacher assignment(s) will be kept
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={clearEnrollments}
              onChange={(e) => setClearEnrollments(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Also remove enrollments</span>
              <span className="mt-1 block text-muted">
                Checked: students no longer see subjects for this session. Unchecked: subjects remain
                but show Awaiting Result.
              </span>
            </span>
          </label>

          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? "Closing term…" : "Close term"}
          </Button>
        </form>

        <ErrorText>{error}</ErrorText>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>

      <Card>
        <h3 className="font-semibold">After closing</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Teacher assignments for the session remain in place.</li>
          <li>Register or re-enroll students for the new session (e.g. 2026/2027).</li>
          <li>Teachers can enter scores again for the new enrollments.</li>
        </ol>
      </Card>
    </AppShell>
  );
}
