import { loadLandingContent } from '@/lib/landing-content';
import { publicStakkContent, stakkCorsHeaders } from '@/lib/stakk-content';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = stakkCorsHeaders(request.headers.get('origin'));
  if (!headers) return new Response('Origin not allowed', { status: 403, headers: { 'Vary': 'Origin', 'Cache-Control': 'no-store' } });
  const content = await loadLandingContent();
  return Response.json(publicStakkContent(content.values), { headers });
}
export function OPTIONS(request: Request) {
  const headers = stakkCorsHeaders(request.headers.get('origin'));
  return new Response(null, { status: headers ? 204 : 403, headers: headers ?? { 'Vary': 'Origin' } });
}
