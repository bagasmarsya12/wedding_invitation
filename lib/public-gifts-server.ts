import {db} from './server';
import {giftCollection} from './gift-collections';
import {publicGiftBooking} from './gift-booking';
import {hasPublicContent,type HomepageGift} from './public-content';
type GiftRow={id:string;title:string;description:string|null;recipient_category:string;image_url:string|null;price_label:string|null;status:string;booking_name:string|null;booking_anonymous:number};
export async function loadPublicGifts():Promise<HomepageGift[]> {
  const rows=await db().prepare('SELECT id,title,description,recipient_category,image_url,price_label,status,booking_name,booking_anonymous FROM gifts WHERE published=1 ORDER BY sort_order,created_at,id').all<GiftRow>();
  return rows.results.filter(g=>hasPublicContent(g.title)).map(g=>({id:g.id,title:g.title,description:g.description,category:giftCollection(g.recipient_category),imageUrl:g.image_url,priceLabel:g.price_label,status:g.status,...publicGiftBooking(g)}));
}
