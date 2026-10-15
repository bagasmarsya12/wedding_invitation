/** Cloudflare cache hits have immutable headers; the route adapter appends its own headers. */
export function mutableMediaResponse(response: Response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}
