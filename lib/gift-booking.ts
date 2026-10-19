export const GIFT_BOOKING_PHONE = '6289681747474';
export const GIFT_BOOKING_MESSAGE = 'Halo Bagas dan Iga aku mau Booking hadiah "{gift}" ke kamu';
export const GIFT_BOOKING_KEYS = ['gift.bookingCta', 'gift.bookingMessage', 'gift.bookedBy', 'gift.anonymousBooker'] as const;

export function validateGiftBooking(value: {name?:unknown;anonymous?:unknown}) {
  if(typeof value.name!=='string'||value.name.length>120||/[\u0000-\u001f\u007f]/.test(value.name)||typeof value.anonymous!=='boolean')return null;
  const name=value.name.trim();
  if(!value.anonymous&&!name)return null;
  return {name:name||null,anonymous:value.anonymous};
}

/** The internal name never reaches a public DTO when anonymity is selected. */
export function publicGiftBooking(gift: {status:string;booking_name?:string|null;booking_anonymous?:number|boolean}) {
  if(gift.status==='available')return {reservedByName:null,bookingAnonymous:false};
  const anonymous=Boolean(gift.booking_anonymous)||!gift.booking_name?.trim();
  return {reservedByName:anonymous?null:gift.booking_name!.trim(),bookingAnonymous:anonymous};
}

export function giftBookedLabel(name:string|null|undefined,anonymous:boolean,template:string,anonymousName:string) {
  const displayName=anonymous||!name?.trim()?anonymousName:name.trim();
  return template.includes('{name}')?template.replaceAll('{name}',()=>displayName):`${template} ${displayName}`;
}

/** Opening a WhatsApp draft does not reserve a gift or send a message. */
export function giftBookingUrl(title: string, template = GIFT_BOOKING_MESSAGE) {
  const text = template.trim() || GIFT_BOOKING_MESSAGE;
  const message = text.includes('{gift}') ? text.replaceAll('{gift}', title) : `${text} "${title}"`;
  return `https://wa.me/${GIFT_BOOKING_PHONE}?text=${encodeURIComponent(message)}`;
}
