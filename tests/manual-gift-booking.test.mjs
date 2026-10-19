import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {validateGiftBooking,publicGiftBooking,giftBookedLabel} from '../lib/gift-booking.ts';

test('manual bookers accept a typed name or anonymous alias, with bounded valid text',()=>{
  assert.deepEqual(validateGiftBooking({name:'  Keluarga Raka  ',anonymous:false}),{name:'Keluarga Raka',anonymous:false});
  assert.deepEqual(validateGiftBooking({name:'',anonymous:true}),{name:null,anonymous:true});
  assert.deepEqual(validateGiftBooking({name:'Internal name',anonymous:true}),{name:'Internal name',anonymous:true});
  for(const input of [{name:' ',anonymous:false},{name:'x'.repeat(121),anonymous:true},{name:'Bad\nName',anonymous:false},{name:{},anonymous:true},{name:'Raka',anonymous:'true'}])assert.equal(validateGiftBooking(input),null);
});
test('public booking data never includes an anonymous internal name or implicit guest identity',()=>{
  const secret='PRIVATE_INTERNAL_BOOKER';
  assert.deepEqual(publicGiftBooking({status:'reserved',booking_name:secret,booking_anonymous:1}),{reservedByName:null,bookingAnonymous:true});
  assert.deepEqual(publicGiftBooking({status:'reserved',booking_name:'Raka',booking_anonymous:0}),{reservedByName:'Raka',bookingAnonymous:false});
  assert.deepEqual(publicGiftBooking({status:'reserved'}),{reservedByName:null,bookingAnonymous:true});
  assert.deepEqual(publicGiftBooking({status:'available',booking_name:secret,booking_anonymous:1}),{reservedByName:null,bookingAnonymous:false});
  assert.ok(!JSON.stringify(publicGiftBooking({status:'purchased',booking_name:secret,booking_anonymous:true})).includes(secret));
});
test('bilingual booking templates insert names literally and retain names if the placeholder is removed',()=>{
  assert.equal(giftBookedLabel('Keluarga Raka',false,'Sudah dibooking oleh {name}','Teman terkasih'),'Sudah dibooking oleh Keluarga Raka');
  assert.equal(giftBookedLabel('Private',true,'Already booked by {name}','A dear friend'),'Already booked by A dear friend');
  assert.equal(giftBookedLabel(null,false,'Sudah dibooking oleh','Teman terkasih'),'Sudah dibooking oleh Teman terkasih');
  assert.equal(giftBookedLabel('$&',false,'Booked by {name}','Friend'),'Booked by $&');
});
test('the additive gift migration retains every existing gift field',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE gifts(id TEXT PRIMARY KEY,title TEXT,status TEXT,reserved_by_guest_id TEXT); INSERT INTO gifts VALUES('existing','Saved gift','reserved','original-guest')");
    const before={...db.prepare('SELECT * FROM gifts').get()};
    db.exec(readFileSync(new URL('../drizzle/0011_manual_gift_booking.sql',import.meta.url),'utf8'));
    const after={...db.prepare('SELECT * FROM gifts').get()};
    assert.equal(after.booking_name,null);assert.equal(after.booking_anonymous,0);
    delete after.booking_name;delete after.booking_anonymous;assert.deepEqual(after,before);
  } finally {db.close();}
});
