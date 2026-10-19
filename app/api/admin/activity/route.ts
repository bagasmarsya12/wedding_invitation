import { apiError, db, privateHeaders, privateJson, requireAdmin } from '@/lib/server';
import { toCsv } from '@/lib/production';
import { guestVisitSummarySql } from '@/lib/visit-activity';
import { loadWebsite } from '@/lib/website-server';

export async function GET(request:Request) {
  if(!await requireAdmin()) return apiError('Admin access is required.',403);
  const [guests,totals,daily,recent,website]=await Promise.all([
    db().prepare(`SELECT g.id,g.display_name,g.guest_group,g.status,g.invitation_sent_at,
      v.first_at,v.last_at,COALESCE(v.sessions,0) AS sessions,COALESCE(v.views,0) AS views,
      COALESCE(v.link_opens,0) link_opens,COALESCE(v.devices,0) devices,COALESCE(v.unidentified_sessions,0) unidentified_sessions,r.attendance,
      c.checked_in_at,c.party_size AS arrived_people,COALESCE(m.marks,0) AS marks
      FROM guests g LEFT JOIN (${guestVisitSummarySql}) v ON v.guest_id=g.id
      LEFT JOIN rsvps r ON r.guest_id=g.id LEFT JOIN guest_checkins c ON c.guest_id=g.id LEFT JOIN (SELECT guest_id,COUNT(*) marks FROM guest_marks GROUP BY guest_id) m ON m.guest_id=g.id
      ORDER BY v.last_at DESC,g.display_name`).all<Record<string,unknown>>(),
    db().prepare(`SELECT COUNT(DISTINCT session_hash) sessions,COALESCE(SUM(views),0) views,COUNT(DISTINCT guest_id) opened,
      COALESCE(SUM(CASE WHEN page='invitation' THEN views ELSE 0 END),0) link_opens,COUNT(DISTINCT device_hash) devices,
      COUNT(DISTINCT CASE WHEN device_hash IS NULL THEN session_hash END) unidentified_sessions FROM page_visits`).first(),
    db().prepare("SELECT substr(first_at,1,10) day,COUNT(DISTINCT session_hash) sessions,SUM(views) views FROM page_visits WHERE first_at>=datetime('now','-30 days') GROUP BY day ORDER BY day").all(),
    db().prepare('SELECT v.page,v.first_at,v.last_at,v.views,g.display_name FROM page_visits v LEFT JOIN guests g ON g.id=v.guest_id ORDER BY v.last_at DESC LIMIT 50').all(),
    loadWebsite(),
  ]);
  if(new URL(request.url).searchParams.get('export')==='csv') return new Response(toCsv([['Guest','Group','Access','First opened (UTC)','Last opened (UTC)','Invitation opens','Detected browsers (minimum)','Sessions without device ID','Sessions','Page views','RSVP','Arrived (UTC)','People arrived','Postcards'],...guests.results.map(r=>[r.display_name,r.guest_group,r.status,r.first_at,r.last_at,r.link_opens,Number(r.sessions)>0&&!Number(r.devices)?'':r.devices,r.unidentified_sessions,r.sessions,r.views,r.attendance??'pending',r.checked_in_at,r.arrived_people,r.marks])]),{headers:{...privateHeaders,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=bagas-iga-link-activity.csv'}});
  return privateJson({guests:guests.results,totals,daily:daily.results,recent:recent.results,trackingEnabled:website.config.trackingEnabled});
}
