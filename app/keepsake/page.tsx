import {AtelierKeepsake} from '@/app/atelier-keepsake';
import {guestKeepsakePayload} from '@/lib/guest-keepsake';
export const dynamic='force-dynamic';
export default async function KeepsakePreviewPage(){return <AtelierKeepsake content={await guestKeepsakePayload({id:'',display_name:''})} />;}
