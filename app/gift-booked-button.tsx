'use client';
import {useLanguage} from './language';
import {giftBookedLabel} from '@/lib/gift-booking';

export function GiftBookedButton({name,anonymous=false}:{name?:string|null;anonymous?:boolean}) {
  const {language,tField}=useLanguage();
  const template=tField('gift.bookedBy')||(language==='id'?'Sudah dibooking oleh {name}':'Already booked by {name}');
  const friend=tField('gift.anonymousBooker')||(language==='id'?'Teman terkasih':'A dear friend');
  return <button type="button" className="gift-booked-state" disabled>{giftBookedLabel(name,anonymous,template,friend)}</button>;
}
