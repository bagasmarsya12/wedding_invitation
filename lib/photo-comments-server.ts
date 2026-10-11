import { adminSessionSecret,cookieValue,db,type GuestRecord } from './server';
import { ARCHIVE_GUEST_COOKIE,readArchiveGuestSession } from './archive-guest-session';
import { COMMENT_PAGE_SIZE,parsePhotoKey,type PhotoComment } from './photo-comments';
import { loadWebsite } from './website-server';
import { hasPublicContent } from './public-content';

export type CommentPhoto={key:string;title:string;image:string|null;live:boolean;enabled:boolean};
export type CommentRow={id:string;photo_key:string;parent_id:string|null;guest_id:string|null;author_kind:'guest'|'couple';author_name:string;message:string;moderation_status:'pending'|'approved'|'hidden';removed_at:string|null;created_at:string;hearts:number;liked:number;reply_count?:number};
export async function archiveGuest(request:Request):Promise<GuestRecord|null> {
  const token=cookieValue(request.headers.get('cookie'),ARCHIVE_GUEST_COOKIE);if(!token)return null;
  const identity=await readArchiveGuestSession(token,await adminSessionSecret());if(!identity)return null;
  return db().prepare("SELECT id,display_name,email,party_limit,status FROM guests WHERE id=? AND token_hash=? AND status='active' LIMIT 1").bind(identity.id,identity.hash).first<GuestRecord>();
}
export async function commentConfig() {
  const result=await db().prepare("SELECT key,value FROM settings WHERE key IN ('photo_comments.enabled','photo_comments.moderation')").all<{key:string;value:string}>();
  return {enabled:result.results.find(r=>r.key==='photo_comments.enabled')?.value!=='off',moderation:result.results.find(r=>r.key==='photo_comments.moderation')?.value!=='off'};
}
export async function commentPhoto(key:string):Promise<CommentPhoto|null> {
  const parsed=parsePhotoKey(key);if(!parsed)return null;
  let photo:Omit<CommentPhoto,'enabled'>|null=null;
  if(parsed.kind==='gallery') {
    const {blocks}=await loadWebsite();const block=blocks.photos.find(p=>p.id===parsed.id);if(!block)return null;
    const media=await db().prepare('SELECT value FROM settings WHERE key=?').bind('media.'+block.slot).first<{value:string}>();
    if(!media?.value)return null;
    photo={key,title:block.caption.id||block.caption.en,image:'/api/admin/media/'+block.slot,live:true};
  } else {
    const row=await db().prepare('SELECT id,title,type,media_url,published,visibility,story,excerpt FROM archive_entries WHERE id=?').bind(parsed.id).first<{id:string;title:string;type:string;media_url:string|null;published:number;visibility:string;story:string|null;excerpt:string|null}>();
    if(!row||row.type==='audio'||!row.media_url)return null;
    photo={key,title:row.title,image:row.media_url,live:!!row.published&&row.visibility==='public'&&hasPublicContent(row.title)&&(hasPublicContent(row.story)||hasPublicContent(row.excerpt))};
  }
  const setting=await db().prepare('SELECT enabled FROM photo_comment_settings WHERE photo_key=?').bind(key).first<{enabled:number}>();
  return {...photo,enabled:setting?.enabled!==0};
}
export async function commentPhotos():Promise<CommentPhoto[]> {
  const [{blocks},media,archive,settings]=await Promise.all([loadWebsite(),db().prepare("SELECT key,value FROM settings WHERE key LIKE 'media.gallery-%'").all<{key:string;value:string}>(),db().prepare("SELECT id,title,media_url,published,visibility,story,excerpt FROM archive_entries WHERE type!='audio' AND media_url IS NOT NULL ORDER BY created_at DESC").all<{id:string;title:string;media_url:string;published:number;visibility:string;story:string|null;excerpt:string|null}>(),db().prepare('SELECT photo_key,enabled FROM photo_comment_settings').all<{photo_key:string;enabled:number}>()]);
  const enabled=new Map(settings.results.map(p=>[p.photo_key,!!p.enabled]));
  return [...blocks.photos.filter(p=>media.results.some(m=>m.key==='media.'+p.slot&&m.value)).map(p=>({key:'gallery:'+p.id,title:p.caption.id||p.caption.en,image:'/api/admin/media/'+p.slot,live:true,enabled:enabled.get('gallery:'+p.id)??true})),...archive.results.map(p=>({key:'archive:'+p.id,title:p.title,image:p.media_url,live:!!p.published&&p.visibility==='public'&&hasPublicContent(p.title)&&(hasPublicContent(p.story)||hasPublicContent(p.excerpt)),enabled:enabled.get('archive:'+p.id)??true}))];
}
const extras="(SELECT COUNT(*) FROM photo_comment_hearts h WHERE h.comment_id=c.id) AS hearts, EXISTS(SELECT 1 FROM photo_comment_hearts h WHERE h.comment_id=c.id AND h.guest_id=?) AS liked";
const visible="c.removed_at IS NULL AND (c.moderation_status='approved' OR (c.moderation_status='pending' AND c.guest_id=?))";
const parentVisible="(c.parent_id IS NULL OR EXISTS(SELECT 1 FROM photo_comments p WHERE p.id=c.parent_id AND p.moderation_status='approved' AND p.removed_at IS NULL))";
export async function commentCounts(keys:string[],guestId:string|null) {
  if(!keys.length)return new Map<string,number>();
  const result=await db().prepare('SELECT c.photo_key,COUNT(*) AS total FROM photo_comments c WHERE c.photo_key IN ('+keys.map(()=>'?').join(',')+') AND '+visible+' AND '+parentVisible+' GROUP BY c.photo_key').bind(...keys,guestId).all<{photo_key:string;total:number}>();
  return new Map(result.results.map(row=>[row.photo_key,Number(row.total)]));
}
export function commentDto(row:CommentRow,guestId:string|null):PhotoComment {
  return {id:row.id,parentId:row.parent_id,name:row.author_name,kind:row.author_kind,message:row.message,createdAt:row.created_at,status:row.moderation_status as 'approved'|'pending',hearts:Number(row.hearts||0),liked:!!row.liked,mine:!!guestId&&row.guest_id===guestId,replies:[],replyCount:Number(row.reply_count||0),replyCursor:null};
}
export async function commentPage(photoKey:string,guestId:string|null,after:string|null,parent:string|null=null) {
  let cursor:CommentRow|null=null;
  if(after)cursor=await db().prepare('SELECT * FROM photo_comments WHERE id=? AND photo_key=? AND parent_id IS ?').bind(after,photoKey,parent).first<CommentRow>();
  if(after&&!cursor)throw new Error('Invalid comment cursor');
  if(parent) {
    const root=await db().prepare("SELECT id FROM photo_comments WHERE id=? AND photo_key=? AND parent_id IS NULL AND moderation_status='approved' AND removed_at IS NULL").bind(parent,photoKey).first();
    if(!root)throw new Error('Reply thread unavailable');
  }
  const direction=parent?'ASC':'DESC',comparison=parent?'>':'<';
  const clause=cursor?' AND (c.created_at '+comparison+' ? OR (c.created_at=? AND c.id '+comparison+' ?))':'';
  const rows=await db().prepare('SELECT c.*,'+extras+', (SELECT COUNT(*) FROM photo_comments r WHERE r.parent_id=c.id AND r.removed_at IS NULL AND (r.moderation_status=\'approved\' OR (r.moderation_status=\'pending\' AND r.guest_id=?))) AS reply_count FROM photo_comments c WHERE c.photo_key=? AND c.parent_id IS ? AND '+visible+clause+' ORDER BY c.created_at '+direction+',c.id '+direction+' LIMIT ?').bind(guestId,guestId,photoKey,parent,guestId,...(cursor?[cursor.created_at,cursor.created_at,cursor.id]:[]),COMMENT_PAGE_SIZE+1).all<CommentRow>();
  const page=rows.results.slice(0,COMMENT_PAGE_SIZE);const comments=page.map(r=>commentDto(r,guestId));
  if(!parent&&page.length) {
    const ids=page.filter(r=>r.moderation_status==='approved').map(r=>r.id);
    if(ids.length){
      const replies=await db().prepare('SELECT * FROM (SELECT c.*,'+extras+',ROW_NUMBER() OVER(PARTITION BY c.parent_id ORDER BY c.created_at,c.id) AS position FROM photo_comments c WHERE c.photo_key=? AND c.parent_id IN ('+ids.map(()=>'?').join(',')+') AND '+visible+') WHERE position<=3 ORDER BY parent_id,created_at,id').bind(guestId,photoKey,...ids,guestId).all<CommentRow>();
      for(const row of replies.results)comments.find(c=>c.id===row.parent_id)?.replies.push(commentDto(row,guestId));
      for(const comment of comments)if(comment.replyCount>comment.replies.length)comment.replyCursor=comment.replies.at(-1)?.id??null;
    }
  }
  const total=await db().prepare('SELECT COUNT(*) AS count FROM photo_comments c WHERE c.photo_key=? AND '+visible+' AND '+parentVisible).bind(photoKey,guestId).first<{count:number}>();
  return {comments,total:total?.count||0,hasMore:rows.results.length>COMMENT_PAGE_SIZE,nextCursor:rows.results.length>COMMENT_PAGE_SIZE?page.at(-1)?.id??null:null};
}
export async function readableComment(id:string) {
  return db().prepare("SELECT c.* FROM photo_comments c WHERE c.id=? AND c.moderation_status='approved' AND c.removed_at IS NULL AND (c.parent_id IS NULL OR EXISTS(SELECT 1 FROM photo_comments p WHERE p.id=c.parent_id AND p.moderation_status='approved' AND p.removed_at IS NULL))").bind(id).first<CommentRow>();
}
