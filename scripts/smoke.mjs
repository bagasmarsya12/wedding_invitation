// Read-only by design: safe for a production Site. Never submits RSVP, gifts, or marks.
const base = process.env.SITE_URL;
if (!base || !/^https?:\/\//.test(base)) {
  console.error("Set SITE_URL to the local or deployed site origin.");
  process.exit(2);
}

const checks = [
  ["homepage", "/", 200, ["Pandiga", "01 November 2026"]],
  ["archive", "/archive", 200, []],
  ["invalid guest", "/invite/not-a-real-invitation", 404, []],
];
for (const [name, path, status, markers] of checks) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  const body = await response.text();
  if (response.status !== status || markers.some(marker => !body.includes(marker))) {
    console.error(`${name}: expected ${status} and essential content; got ${response.status}`);
    process.exitCode = 1;
  } else console.log(`${name}: OK (${response.status})`);
}
const admin = await fetch(new URL("/api/admin/state", base), { redirect: "manual" });
if (admin.status === 200) { console.error("anonymous admin access: unexpectedly allowed"); process.exitCode = 1; }
else console.log(`anonymous admin access: blocked (${admin.status})`);

if (process.env.INVITE_TEST_URL) {
  const invite = await fetch(process.env.INVITE_TEST_URL, { redirect: "manual" });
  if (invite.status !== 200) { console.error(`test invitation: got ${invite.status}`); process.exitCode = 1; }
  else console.log("test invitation: OK (200)");
}
