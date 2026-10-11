export const COMMENT_LIMIT = 600;
export const COMMENT_PAGE_SIZE = 15;
export const COMMENT_OVERVIEW_LIMIT = 40;
export type PhotoCommentOverview = { viewer:{name:string}|null; requiresApproval:boolean; photos:Record<string,{total:number;enabled:boolean}> };
export type PhotoComment = { id:string; parentId:string|null; name:string; kind:'guest'|'couple'; message:string; createdAt:string; status:'pending'|'approved'; hearts:number; liked:boolean; mine:boolean; replies:PhotoComment[]; replyCount:number;replyCursor:string|null };
export type PhotoCommentPage = { photo:{key:string;title:string}; enabled:boolean; requiresApproval:boolean; viewer:{name:string}|null; comments:PhotoComment[]; total:number; hasMore:boolean; nextCursor:string|null };
export function parsePhotoKey(value:unknown): {kind:'gallery'|'archive';id:string}|null {
  if(typeof value!=='string')return null;
  const match=/^(gallery|archive):([A-Za-z0-9_-]{1,80})$/.exec(value);
  return match?{kind:match[1] as 'gallery'|'archive',id:match[2]}:null;
}
export function commentMessage(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const text=value.trim();
  return text&&Array.from(text).length<=COMMENT_LIMIT&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)?text:null;
}
export function commentId(value:unknown):string|null {
  return typeof value==='string'&&/^pc_[a-f0-9-]{36}$/.test(value)?value:null;
}
