export const GIFT_BOOKING_PHONE = '6289681747474';
export const GIFT_BOOKING_MESSAGE = 'Halo Bagas dan Iga aku mau Booking hadiah "{gift}" ke kamu';
export const GIFT_BOOKING_KEYS = ['gift.bookingCta', 'gift.bookingMessage'] as const;

/** Opening a WhatsApp draft does not reserve a gift or send a message. */
export function giftBookingUrl(title: string, template = GIFT_BOOKING_MESSAGE) {
  const text = template.trim() || GIFT_BOOKING_MESSAGE;
  const message = text.includes('{gift}') ? text.replaceAll('{gift}', title) : `${text} "${title}"`;
  return `https://wa.me/${GIFT_BOOKING_PHONE}?text=${encodeURIComponent(message)}`;
}
