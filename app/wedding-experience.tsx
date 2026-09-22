import Script from "next/script";
import legacyDocument from "./legacy-home.html?raw";

type Props = { guestName?: string; token?: string; partyLimit?: number };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

export function WeddingExperience({ guestName = "", token = "", partyLimit = 2 }: Props) {
  const body = legacyDocument.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  const withoutScript = body.replace(/<script[\s\S]*?<\/script>/gi, "").replaceAll('src="assets/', 'src="/assets/').replaceAll('srcset="assets/', 'srcset="/assets/');
  const safeName = escapeHtml(guestName.slice(0, 80));
  const safeToken = escapeHtml(token);
  const context = `<div id="invite-context" data-token="${safeToken}" data-guest-name="${safeName}" data-party-limit="${Math.max(1, Math.min(20, partyLimit))}" hidden></div>`;
  const personalized = safeName
    ? withoutScript.replace("Tamu Spesial Kami</h1>", `${safeName}</h1>`)
    : withoutScript;

  return (
    <>
      <link rel="stylesheet" href="/styles.css" />
      <link rel="stylesheet" href="/interior.css" />
      <link rel="stylesheet" href="/world.css" />
      <noscript><style>{`.opening{display:none!important}body{overflow:auto!important}.reveal{opacity:1!important;transform:none!important}`}</style></noscript>
      <script dangerouslySetInnerHTML={{ __html: "document.body.classList.add('invitation-locked')" }} />
      <div dangerouslySetInnerHTML={{ __html: `${context}${personalized}` }} />
      <Script src="/script.js" strategy="afterInteractive" />
      <Script src="/world.js" strategy="afterInteractive" />
    </>
  );
}
