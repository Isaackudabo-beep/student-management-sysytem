"use client";

// Purpose: Admin session tools — archive/close term + promote/repeat after Third Term.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import type { Term } from "@/lib/types";

type SessionRow = {
  session: string;
  term: Term | null;
  enrollments: number;
  scores: number;
  teacherAssignments: number;
  archived?: number;
};

const TERMS: Term[] = ["FIRST", "SECOND", "THIRD"];

export default function TermPage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [session, setSession] = useState("2025/2026");
  const [term, setTerm] = useState<Term>("FIRST");
  const [clearEnrollments, setClearEnrollments] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string>("");

  async function load() {
    try {
      const res = await api<{ success: true; data: SessionRow[] }>("/api/term/sessions");
      setSessions(res.data);
      if (res.data[0]?.session) {
        setSession((s) => s || res.data[0].session);
        if (res.data[0].term) setTerm(res.data[0].term);
      }
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load sessions"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = sessions.find((s) => s.session === session && s.term === term);

  async function onClose(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (
      !confirm(
        `Close ${session} ${term} term? Graded results will be archived, then live scores cleared. Students, teachers, classes, and subjects are kept.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ success: true; data: { message: string } }>("/api/term/close", {
        method: "POST",
        body: JSON.stringify({ session, term, clearEnrollments }),
      });
      setMessage(res.data.message);
      toast.success("Term closed — results archived");
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Close term failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onPromote() {
    setError("");
    setPromoteResult("");
    if (
      !confirm(
        `Promote students for ${session} THIRD term? Average ≥ 45% → next class; below 45% → Repeated.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await api<{
        success: true;
        data: { message: string; summary: { promoted: number; repeating: number; skipped: number } };
      }>("/api/term/promote", {
        method: "POST",
        body: JSON.stringify({ session, term: "THIRD" }),
      });
      setPromoteResult(
        `${res.data.message} (promoted ${res.data.summary.promoted}, repeating ${res.data.summary.repeating}, skipped ${res.data.summary.skipped})`
      );
      toast.success("Promotion complete");
    } catch (err) {
      const msg = formatApiError(err, "Promotion failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Session & Promotion">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Close term (archive results)
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Archives graded scores for the selected session + term, then clears live scores. Students,
          teachers, classes, subjects, and teacher assignments stay.
        </p>

        <form onSubmit={onClose} className="mt-6 grid max-w-xl gap-4">
          <div>
            <Label>Session</Label>
            <Input value={session} onChange={(e) => setSession(e.target.value)} required />
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

          {selected ? (
            <div className="rounded-2xl border border-line bg-brand-soft/40 px-4 py-3 text-sm">
              <p className="font-semibold">
                {selected.session} · {selected.term}
              </p>
              <p className="mt-1 text-muted">
                {selected.scores} live score(s) · {selected.enrollments} enrollment(s) ·{" "}
                {selected.archived ?? 0} already archived · {selected.teacherAssignments} teacher
                assignment(s) kept
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
                Checked: students no longer see subjects for this term. Unchecked: subjects remain
                as Awaiting Result.
              </span>
            </span>
          </label>

          <Button type="submit" variant="danger" loading={busy}>
            Close term & archive
          </Button>
        </form>

        <ErrorText>{error}</ErrorText>
        {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
      </Card>

      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Promote students (Third Term)
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Uses each student’s cumulative average for the <strong>THIRD</strong> term of the session.
          ≥ 45% → promoted to the next class (same arm when available). Below 45% → marked{" "}
          <strong>Repeated</strong> on their portal.
        </p>
        <div className="mt-4">
          <Button type="button" loading={busy} onClick={() => void onPromote()}>
            Run promotion for {session}
          </Button>
        </div>
        {promoteResult ? <p className="mt-4 text-sm text-brand">{promoteResult}</p> : null}
      </Card>

      <Card>
        <h3 className="font-semibold">Active sessions</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {sessions.map((s) => (
            <li key={`${s.session}-${s.term}`} className="border-b border-line py-2">
              <span className="font-semibold">
                {s.session} {s.term ? `· ${s.term}` : ""}
              </span>
              <span className="text-muted">
                {" "}
                — {s.scores} scores, {s.enrollments} enrollments, {s.archived ?? 0} archived
              </span>
            </li>
          ))}
          {sessions.length === 0 ? <li className="text-muted">No session data yet</li> : null}
        </ul>
      </Card>
    </AppShell>
  );
}
