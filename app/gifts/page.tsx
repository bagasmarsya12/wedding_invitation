
import { redirect } from 'next/navigation';

export default function GiftsPage() {
  redirect('/?view=full#gifts');
}
