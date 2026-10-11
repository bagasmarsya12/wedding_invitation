"use client";

import { useState } from "react";
import { DeferredMarkEditor } from "./deferred-mark-editor";
import { T, useLanguage } from "./language";
import type { GuestRsvpController } from "./use-guest-rsvp";
import type { MarkStyle } from "@/lib/mark-styles";

type Props = {
  token: string; guestName: string; defaultStyle: MarkStyle;
  ready: boolean; marksEnabled: boolean; rsvp: GuestRsvpController; partyLimit: number;
};

/** Postcard and attendance remain independent; RSVP state is shared with the folio. */
export function ReplyStudio({ token, guestName, defaultStyle, ready, marksEnabled, rsvp, partyLimit }: Props) {
  const { tField } = useLanguage();
  const [previewStatus, setPreviewStatus] = useState('');
  const preview = !token;
  const canReply = rsvp.enabled;
  async function saveAttendance() {
    if (!canReply) return true;
    if (preview) { setPreviewStatus("Preview only — open your personal invitation to save your reply."); return true; }
    return rsvp.save();
  }
  return <DeferredMarkEditor token={token} guestName={guestName} defaultStyle={defaultStyle} reply={{
    preview, allowEmpty: canReply, marksEnabled: ready && marksEnabled,
    canSubmit: ready && !rsvp.busy && (canReply ? rsvp.loaded && Boolean(rsvp.attendance) : marksEnabled),
    saveAttendance,
    submitLabel: preview ? "Preview my reply" : "Send card",
    controls: <div className="reply-attendance">
      <p className="reply-recipient"><T>A reply from </T><strong>{guestName || <T>our favourite people</T>}</strong></p>
      <fieldset disabled={!ready || !rsvp.loaded || !canReply || rsvp.busy}>
        <legend><T>Will you be there?</T></legend>
        <label className={rsvp.attendance === "yes" ? "is-selected" : ""}><input type="radio" name="attendance" value="yes" checked={rsvp.attendance === "yes"} onChange={() => rsvp.setAttendance("yes")} /><span><T>I’ll be there.</T></span></label>
        <label className={rsvp.attendance === "no" ? "is-selected" : ""}><input type="radio" name="attendance" value="no" checked={rsvp.attendance === "no"} onChange={() => rsvp.setAttendance("no")} /><span><T>I can’t make it.</T></span></label>
        {rsvp.attendance === 'yes' && <label className="guest-party-label"><T field="guest.party" /><select value={rsvp.partySize} onChange={event => rsvp.setPartySize(Number(event.target.value))}>{Array.from({ length: partyLimit }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {tField(index ? 'guest.people' : 'guest.person')}</option>)}</select></label>}
      </fieldset>
      {ready && !canReply && <p className="reply-closed"><T>RSVP is closed. Thank you for being part of our day.</T></p>}
      {!rsvp.loaded && rsvp.message === 'loadError' && <button type="button" className="reply-retry" onClick={rsvp.reload}><T>Try loading my answer again</T></button>}
      {!rsvp.loaded && rsvp.message !== 'loadError' && <p className="reply-loading"><T>Loading your answer…</T></p>}
      {rsvp.saved && <div className="reply-received" data-attendance={rsvp.saved.attendance}><span aria-hidden="true">✓</span><span><T>Reply received</T><small><T>{rsvp.saved.attendance === "yes" ? "I’ll be there." : "I can’t make it."}</T>{rsvp.saved.attendance === 'yes' && <> · {rsvp.saved.partySize} <T field="guest.people" /></>}</small></span></div>}
      {rsvp.saved && rsvp.dirty && <p className="reply-unsaved"><T>Your changed answer has not been saved yet.</T></p>}
    </div>,
    footer: <p className="reply-status" role="status">{previewStatus ? <T>{previewStatus}</T> : rsvp.message ? <T field={`guest.${rsvp.message}`} /> : null}</p>,
  }} />;
}
