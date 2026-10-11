import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
const hook=registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);}throw error;}}});
const {createArchiveGuestSession,readArchiveGuestSession}=await import('../lib/archive-guest-session.ts');
const {createSessionToken,readSessionToken}=await import('../lib/admin-auth.ts');
const {parsePhotoKey,commentMessage}=await import('../lib/photo-comments.ts');
hook.deregister();

test('guest signatures are purpose-separated, expire, and reject tampering or a different signing key',async()=>{
  const key=crypto.getRandomValues(new Uint8Array(32)),identity={id:'g_fixture',hash:'a'.repeat(64)},now=1_800_000_000_000;
  const token=await createArchiveGuestSession(identity,key,now);
  assert.deepEqual(await readArchiveGuestSession(token,key,now),identity);
  assert.equal(await readSessionToken(token,key,now),null,'Guest cookie is not an admin cookie');
  const admin=await createSessionToken(JSON.stringify(identity),key,now);
  assert.equal(await readArchiveGuestSession(admin,key,now),null,'Admin cookie is not a guest cookie');
  assert.equal(await readArchiveGuestSession(token,crypto.getRandomValues(new Uint8Array(32)),now),null);
  assert.equal(await readArchiveGuestSession(token,key,now+7*86400000+1),null);
  assert.equal(await readArchiveGuestSession(token.slice(1),key,now),null);
});

test('comments use stable photo identifiers and bounded plain text',()=>{
  assert.deepEqual(parsePhotoKey('gallery:photos-a1'),{kind:'gallery',id:'photos-a1'});
  assert.deepEqual(parsePhotoKey('archive:arc_123'),{kind:'archive',id:'arc_123'});
  for(const key of ['https://example.com/photo','gallery:../../x','archive:','gallery:x?other=1',null])assert.equal(parsePhotoKey(key),null);
  assert.equal(commentMessage('  Satu kenangan.\nDua senyum.  '),'Satu kenangan.\nDua senyum.');
  assert.equal(commentMessage('💚'.repeat(600)),'💚'.repeat(600));
  for(const value of ['', '   ', 'a'.repeat(601),'bad\0text',12])assert.equal(commentMessage(value),null);
});

test('database rejects cross-photo and nested replies, unapproved parents, duplicate hearts, and invalid authors',async()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec('PRAGMA foreign_keys=ON;CREATE TABLE guests(id TEXT PRIMARY KEY);INSERT INTO guests VALUES (\'g1\'),(\'g2\');');
    db.exec(await readFile(new URL('../drizzle/0009_photo_comments.sql',import.meta.url),'utf8'));
    const insert=db.prepare('INSERT INTO photo_comments(id,photo_key,parent_id,guest_id,author_kind,author_name,message,moderation_status) VALUES (?,?,?,?,?,?,?,?)');
    insert.run('root','archive:a',null,'g1','guest','Guest','Hello','approved');
    insert.run('pending','archive:a',null,'g1','guest','Guest','Waiting','pending');
    insert.run('reply','archive:a','root','g2','guest','Guest 2','Reply','approved');
    for(const [id,photo,parent] of [['cross','archive:b','root'],['nested','archive:a','reply'],['unapproved','archive:a','pending']])assert.throws(()=>insert.run(id,photo,parent,'g2','guest','Guest','No','approved'));
    assert.throws(()=>insert.run('bad-author','archive:a',null,null,'guest','Guest','No','approved'));
    assert.throws(()=>insert.run('empty','archive:a',null,'g1','guest','Guest',' ','approved'));
    db.exec("INSERT INTO photo_comment_hearts(comment_id,guest_id) VALUES ('root','g1')");
    assert.throws(()=>db.exec("INSERT INTO photo_comment_hearts(comment_id,guest_id) VALUES ('root','g1')"));
    db.exec("UPDATE photo_comments SET removed_at=CURRENT_TIMESTAMP WHERE id='root'");
    assert.throws(()=>insert.run('removed-parent','archive:a','root','g1','guest','Guest','No','approved'));
  }finally{db.close();}
});
