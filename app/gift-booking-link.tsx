'use client';
import { useLanguage } from './language';
import { giftBookingUrl } from '@/lib/gift-booking';

export function GiftBookingLink({ title, disabled = false }: { title: string; disabled?: boolean }) {
  const { tField, language, content } = useLanguage();
  const label = tField('gift.bookingCta') || (language === 'id' ? 'Booking Hadiah ini' : 'Book this gift via WhatsApp');
  // Message templates keep the owner's wording; public couple-name normalization is presentation only.
  const template = content[language === 'id' ? 'id.gift.bookingMessage' : 'gift.bookingMessage'] ?? content['gift.bookingMessage'];
  if (disabled) return <button type="button" disabled>{label}</button>;
  return <a className="gift-booking-link" href={giftBookingUrl(title, template)} target="_blank" rel="noopener noreferrer" aria-label={`${label}: ${title}`}>{label}</a>;
}
