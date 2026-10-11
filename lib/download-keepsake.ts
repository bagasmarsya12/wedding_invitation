/** Start the requested save as soon as its async export is ready. The visible
 * download link remains available for browsers that require another gesture. */
export function downloadKeepsake(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.hidden = true;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); }
}
