'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type Attendance = '' | 'yes' | 'no';
type SavedReply = { attendance: 'yes' | 'no'; partySize: number };
type ReplyResponse = { rsvp: { attendance: string; party_size: number } | null; enabled: boolean; error?: string };
type Message = '' | 'loading' | 'loadError' | 'saving' | 'saved' | 'saveError' | 'closed';

/** A single RSVP state is shared by the personal folio and postcard studio. */
export function useGuestRsvp({ token, partyLimit, active, rsvpEnabled }: { token: string; partyLimit: number; active: boolean; rsvpEnabled: boolean }) {
  const [attendance, setAttendanceState] = useState<Attendance>('');
  const [partySize, setPartySizeState] = useState(partyLimit);
  const [saved, setSaved] = useState<SavedReply | null>(null);
  const [loaded, setLoaded] = useState(!token);
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>('');
  const [revision, setRevision] = useState(0);
  const saving = useRef(false);
  const mounted = useRef(true);
  const enabled = rsvpEnabled && inviteEnabled;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!token || !active) return;
    const controller = new AbortController();
    queueMicrotask(()=>{if(!controller.signal.aborted){setLoaded(false);setMessage('loading');}});
    fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json() as ReplyResponse;
        if (!response.ok) throw new Error('Reply unavailable');
        return data;
      }).then(data => {
        if (controller.signal.aborted) return;
        const answer = data.rsvp?.attendance;
        const count = answer === 'yes' ? Math.min(partyLimit, Math.max(1, data.rsvp?.party_size ?? partyLimit)) : 0;
        setSaved(answer === 'yes' || answer === 'no' ? { attendance: answer, partySize: count } : null);
        setAttendanceState(answer === 'yes' || answer === 'no' ? answer : '');
        setPartySizeState(count || partyLimit);
        setInviteEnabled(data.enabled !== false); setLoaded(true); setMessage('');
      }).catch(() => { if (!controller.signal.aborted) setMessage('loadError'); });
    return () => controller.abort();
  }, [token, active, partyLimit, revision]);

  const setAttendance = useCallback((value: Attendance) => { setAttendanceState(value); setMessage(''); }, []);
  const setPartySize = useCallback((value: number) => { setPartySizeState(value); setMessage(''); }, []);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  // The form only edits attendance; the server owns the invitation's party count.
  const dirty = saved?.attendance !== attendance;

  async function save() {
    if (!enabled) { setMessage('closed'); return false; }
    if (!loaded || !attendance || saving.current) return false;
    if (!token) return true;
    if (!dirty) { setMessage('saved'); return true; }
    saving.current = true; setBusy(true); setMessage('saving');
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        // Attendance-only updates preserve a previous party count; first replies use the invitation quota.
        body: JSON.stringify({ attendance }),
      });
      const result = await response.json() as { attendance: 'yes' | 'no'; partySize: number; error?: string };
      if (!response.ok) {
        if (response.status === 403 && mounted.current) { setInviteEnabled(false); setMessage('closed'); }
        throw new Error('Reply not saved');
      }
      if (mounted.current) { setSaved({ attendance: result.attendance, partySize: result.partySize }); setMessage('saved'); }
      return true;
    } catch { if (mounted.current) setMessage(current => current === 'closed' ? current : 'saveError'); return false; }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  return { attendance, partySize, saved, loaded, enabled, busy, message, dirty, setAttendance, setPartySize, reload, save };
}
export type GuestRsvpController = ReturnType<typeof useGuestRsvp>;
