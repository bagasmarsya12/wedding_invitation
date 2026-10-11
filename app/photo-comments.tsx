'use client';
import { useEffect,useState,type FormEvent,type ReactElement } from 'react';
import { T,useLanguage } from './language';
import { waitForArchiveGuest } from './guest-archive-session';
import { COMMENT_LIMIT,type PhotoComment,type PhotoCommentPage } from '@/lib/photo-comments';
import { notifyPhotoCommentsChanged } from './photo-comment-card';

async function jsonRequest<T = PhotoCommentPage>(url:string,options?:RequestInit) {
  const response=await fetch(url,{cache:'no-store',...options});const data=await response.json() as T & {error?:string};
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Komentar belum bisa disimpan.');
  return data as T;
}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase();}

export function PhotoComments({photoKey}:{photoKey:string}) {
  const {language,tField}=useLanguage();
  const [data,setData]=useState<PhotoCommentPage|null>(null),[error,setError]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState('');
  const [text,setText]=useState(''),[replyTo,setReplyTo]=useState<string|null>(null),[replyText,setReplyText]=useState(''),[deleting,setDeleting]=useState<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    void waitForArchiveGuest().then(()=>jsonRequest('/api/photo-comments?photo='+encodeURIComponent(photoKey),{signal:controller.signal})).then(result=>{if(!controller.signal.aborted){setData(result);setError(false);}}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[photoKey]);
  async function refresh(){setBusy('refresh');setNotice('');try{await waitForArchiveGuest();setData(await jsonRequest('/api/photo-comments?photo='+encodeURIComponent(photoKey)));setError(false);notifyPhotoCommentsChanged(photoKey);}catch{setError(true);}finally{setBusy('');}}
  async function send(event:FormEvent,parent:string|null=null) {
    event.preventDefault();if(busy)return;setBusy(parent||'new');setNotice('');
    try {
      const result=await jsonRequest<{comment:PhotoComment}>('/api/photo-comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({photo:photoKey,message:parent?replyText:text,parentId:parent})}) as {comment:PhotoComment};
      setData(current=>current?{...current,total:current.total+1,comments:parent?current.comments.map(row=>row.id===parent?{...row,replies:[...row.replies,result.comment],replyCount:row.replyCount+1}:row):[result.comment,...current.comments]}:current);
      if(parent){setReplyTo(null);setReplyText('');}else setText('');
      setNotice(result.comment.status==='pending'?tField('photoComments.pendingSent'):tField('photoComments.sent'));
      notifyPhotoCommentsChanged(photoKey);
    }catch(e){setNotice(e instanceof Error?e.message:tField('photoComments.sendError'));}finally{setBusy('');}
  }
  function changeComment(id:string,change:(row:PhotoComment)=>PhotoComment) {
    setData(current=>current?{...current,comments:current.comments.map(row=>row.id===id?change(row):{...row,replies:row.replies.map(reply=>reply.id===id?change(reply):reply)})}:current);
  }
  async function heart(comment:PhotoComment) {
    if(busy)return;setBusy(comment.id);setNotice('');
    try {const result=await jsonRequest<{hearts:number;liked:boolean}>('/api/photo-comments/'+comment.id+'/heart',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({liked:!comment.liked})});changeComment(comment.id,row=>({...row,hearts:result.hearts,liked:result.liked}));}
    catch(e){setNotice(e instanceof Error?e.message:tField('photoComments.sendError'));}finally{setBusy('');}
  }
  async function remove(comment:PhotoComment) {
    if(deleting!==comment.id){setDeleting(comment.id);return;}if(busy)return;setBusy(comment.id);
    try {await jsonRequest('/api/photo-comments/'+comment.id,{method:'DELETE'});setData(current=>current?{...current,total:Math.max(0,current.total-(comment.parentId?1:1+comment.replyCount)),comments:current.comments.filter(row=>row.id!==comment.id).map(row=>({...row,replies:row.replies.filter(reply=>reply.id!==comment.id),replyCount:row.id===comment.parentId?Math.max(0,row.replyCount-1):row.replyCount}))}:current);setDeleting(null);notifyPhotoCommentsChanged(photoKey);}
    catch(e){setNotice(e instanceof Error?e.message:tField('photoComments.sendError'));}finally{setBusy('');}
  }
  async function more(parent:PhotoComment|null=null) {
    if(!data||busy)return;setBusy(parent?.id||'more');
    const after=parent?parent.replyCursor:data.nextCursor;
    try {const result=await jsonRequest('/api/photo-comments?photo='+encodeURIComponent(photoKey)+(parent?'&parent='+parent.id:'')+(after?'&after='+after:''));
      if(parent)changeComment(parent.id,row=>({...row,replyCursor:result.nextCursor,replies:[...row.replies,...result.comments.filter((c:PhotoComment)=>!row.replies.some(r=>r.id===c.id))].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))}));
      else setData(current=>current?{...current,comments:[...current.comments,...result.comments.filter((c:PhotoComment)=>!current.comments.some(r=>r.id===c.id))],hasMore:result.hasMore,nextCursor:result.nextCursor,total:result.total}:current);
    }catch{setNotice(tField('photoComments.error'));}finally{setBusy('');}
  }
  const date=(value:string)=>new Intl.DateTimeFormat(language==='id'?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value.replace(' ','T')+'Z'));
  const row=(comment:PhotoComment,root=false):ReactElement=><article className={'photo-comment'+(comment.kind==='couple'?' is-couple':'')} key={comment.id}>
    <span className="photo-comment-avatar" aria-hidden="true">{comment.kind==='couple'?'I&B':initials(comment.name)}</span>
    <div className="photo-comment-copy"><div className="photo-comment-bubble"><strong>{comment.name}</strong>{comment.kind==='couple'&&<span className="photo-comment-couple"><T field="photoComments.couple"/></span>}<p>{comment.message}</p></div>
      <div className="photo-comment-actions"><time dateTime={comment.createdAt.replace(' ','T')+'Z'}>{date(comment.createdAt)}</time>
        {comment.status==='pending'?<span className="photo-comment-pending"><T field="photoComments.pending"/></span>:<>
          <button type="button" aria-pressed={comment.liked} disabled={!!busy||!data?.viewer||!data.enabled} onClick={()=>void heart(comment)}><span aria-hidden="true">{comment.liked?'♥':'♡'}</span> <T field={comment.liked?'photoComments.liked':'photoComments.like'}/>{comment.hearts>0&&<span> {comment.hearts}</span>}</button>
          {root&&data?.viewer&&data.enabled&&<button type="button" disabled={!!busy} onClick={()=>{setReplyTo(comment.id);setReplyText('');}}><T field="photoComments.reply"/></button>}
        </>}
        {comment.mine&&<button type="button" disabled={!!busy} onClick={()=>void remove(comment)}><T field={deleting===comment.id?'photoComments.deleteConfirm':'photoComments.delete'}/></button>}
        {deleting===comment.id&&<button type="button" onClick={()=>setDeleting(null)}><T field="photoComments.cancel"/></button>}
      </div>
      {root&&comment.replies.length>0&&<div className="photo-comment-replies">{comment.replies.map(reply=>row(reply))}</div>}
      {root&&comment.replyCursor&&<button type="button" className="photo-comments-more" disabled={!!busy} onClick={()=>void more(comment)}><T field="photoComments.moreReplies"/></button>}
      {root&&replyTo===comment.id&&<form className="photo-comment-reply-form" onSubmit={event=>void send(event,comment.id)}><label><span><T field="photoComments.replying"/> {comment.name}</span><textarea autoFocus required maxLength={COMMENT_LIMIT} rows={2} value={replyText} placeholder={tField('photoComments.replyPlaceholder')} onChange={event=>setReplyText(event.target.value)}/></label><div><button type="submit" disabled={!!busy||!replyText.trim()}><T field="photoComments.sendReply"/></button><button type="button" onClick={()=>setReplyTo(null)}><T field="photoComments.cancel"/></button></div></form>}
    </div>
  </article>;
  return <section className="photo-comments" aria-label={tField('photoComments.title')}><header><h3><T field="photoComments.title"/></h3>{data&&<span>{data.total}</span>}</header>
    {error?<div role="alert"><p><T field="photoComments.error"/></p><button type="button" disabled={!!busy} onClick={()=>void refresh()}><T field="photoComments.retry"/></button></div>:!data?<p role="status"><T field="photoComments.loading"/></p>:<>
      <div className="photo-comment-list">{data.comments.length?data.comments.map(comment=>row(comment,true)):<p className="photo-comments-empty"><T field="photoComments.empty"/></p>}</div>
      {data.hasMore&&<button type="button" className="photo-comments-more" disabled={!!busy} onClick={()=>void more()}><T field="photoComments.more"/></button>}
      {!data.enabled?<p className="photo-comments-note"><T field="photoComments.closed"/></p>:!data.viewer?<p className="photo-comments-note"><T field="photoComments.signIn"/></p>:<form className="photo-comments-composer" onSubmit={event=>void send(event)}><label><span><T field="photoComments.identity"/> <strong>{data.viewer.name}</strong></span><textarea required maxLength={COMMENT_LIMIT} rows={3} value={text} placeholder={tField('photoComments.placeholder')} onChange={event=>setText(event.target.value)}/></label><small>{data.requiresApproval?<T field="photoComments.reviewNote"/>:<T field="photoComments.identityNote"/>}</small><div><span>{text.length}/{COMMENT_LIMIT}</span><button type="submit" disabled={!!busy||!text.trim()}><T field="photoComments.send"/></button></div></form>}
      <button type="button" className="photo-comments-refresh" disabled={!!busy} onClick={()=>void refresh()}><T field="photoComments.refresh"/></button>
    </>}
    {notice&&<p className="photo-comments-notice" role="status">{notice}</p>}
  </section>;
}
