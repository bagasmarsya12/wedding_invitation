"use client";

import { useEffect, useState } from "react";
import { DeferredMarkEditor } from "./deferred-mark-editor";
import { T } from "./language";
import type { MarkStyle } from "@/lib/mark-styles";

type Attendance = "" | "yes" | "no";
type Props = {
  token: string; guestName: string; defaultStyle: MarkStyle;
  ready: boolean; rsvpEnabled: boolean; marksEnabled: boolean;
  onAttendanceSaved: (attending: boolean) => void;
};

/** One reply surface, two independent private/public persistence paths. */
export function ReplyStudio({ token, guestName, defaultStyle, ready, rsvpEnabled, marksEnabled, onAttendanceSaved }: Props) {
  const [attendance, setAttendance] = useState<Attendance>("");
  const [saved, setSaved] = useState<Attendance>("");
  const [loaded, setLoaded] = useState(!token);
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const canReply = rsvpEnabled && inviteEnabled;
  const preview = !token;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json() as { error?: string; enabled: boolean; rsvp: { attendance: string } | null };
        if (!response.ok) throw new Error(data.error || "Your answer could not be loaded. Try again.");
        return data;
      })
      .then(data => {
        if (cancelled) return;
        const value = data.rsvp?.attendance;
        const answer = value === "yes" || value === "no" ? value : "";
        setAttendance(answer); setSaved(answer); setInviteEnabled(data.enabled !== false); setLoaded(true); setStatus("");
        onAttendanceSaved(answer === "yes");
      })
      .catch(() => { if (!cancelled) setStatus("Your answer could not be loaded. Try again."); });
    return () => { cancelled = true; };
  }, [token, revision, onAttendanceSaved]);

  async function saveAttendance() {
    if (!canReply) return true; // Postcards can remain open after the RSVP deadline.
    if (!attendance || !loaded) return false;
    if (preview) { setStatus("Preview only — open your personal invitation to save your reply."); return true; }
    if (saved === attendance) { setStatus("Your answer is already saved."); return true; }
    setStatus("Saving your answer…");
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attendance }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your answer could not be saved. Please try again.");
      setSaved(attendance); onAttendanceSaved(attendance === "yes");
      setStatus(attendance === "yes" ? "Your answer is saved. See you there." : "Your answer is saved. Thank you for letting us know.");
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your answer could not be saved. Please try again.");
      return false;
    }
  }

  return <DeferredMarkEditor token={token} guestName={guestName} defaultStyle={defaultStyle} reply={{
    preview, allowEmpty: canReply, marksEnabled: ready && marksEnabled,
    canSubmit: ready && (canReply ? loaded && Boolean(attendance) : marksEnabled),
    saveAttendance,
    submitLabel: preview ? "Preview my reply" : canReply ? "Save my reply" : "Send my postcard",
    controls: <div className="reply-attendance">
      <p className="reply-recipient"><T>A reply from </T><strong>{guestName || <T>our favourite people</T>}</strong></p>
      <fieldset disabled={!ready || !loaded || !canReply}>
        <legend><T>Will you be there?</T></legend>
        <label className={attendance === "yes" ? "is-selected" : ""}><input type="radio" name="attendance" value="yes" checked={attendance === "yes"} onChange={() => setAttendance("yes")} /><span><T>I’ll be there.</T></span></label>
        <label className={attendance === "no" ? "is-selected" : ""}><input type="radio" name="attendance" value="no" checked={attendance === "no"} onChange={() => setAttendance("no")} /><span><T>I can’t make it.</T></span></label>
      </fieldset>
      <p className="reply-privacy"><T>Your attendance stays private. A postcard is optional.</T></p>
      {ready && !canReply && <p className="reply-closed"><T>RSVP is closed. Thank you for being part of our day.</T></p>}
      {!loaded && status && <button type="button" className="reply-retry" onClick={() => { setStatus(""); setRevision(value => value + 1); }}><T>Try loading my answer again</T></button>}
      {!loaded && !status && <p className="reply-loading"><T>Loading your answer…</T></p>}
      {saved && <div className="reply-received" data-attendance={saved}><span aria-hidden="true">✓</span><span><T>Reply received</T><small><T>{saved === "yes" ? "I’ll be there." : "I can’t make it."}</T></small></span></div>}
      {saved && attendance !== saved && <p className="reply-unsaved"><T>Your changed answer has not been saved yet.</T></p>}
    </div>,
    footer: <p className="reply-status" role="status"><T>{status}</T></p>,
  }} />;
}
