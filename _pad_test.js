/* Does the pad carry the auth fragment across the host move?

   The tokens ride in the URL fragment, which never reaches a server, so the
   forward has to re-attach it in JS. That is the one thing in this file that
   can silently break: get it wrong and the pad still answers 200, still looks
   fine, and every invite lands on the app with no session.

   Runs the real script out of index.html in a vm with a mocked location.
       node pad_test.js
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = "https://shift.appellation.th1.ai/";
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
// 404.html is the fallback for every unclaimed path, so it must be the same page.
if (fs.readFileSync(path.join(__dirname, "404.html"), "utf8") !== html) {
  console.log("FAIL  404.html differs from index.html");
  process.exit(1);
}
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const cases = [
  ["recovery link on the bare root", "/", "",
   "#access_token=eyJtest&refresh_token=r1&expires_in=3600&type=recovery",
   APP + "#access_token=eyJtest&refresh_token=r1&expires_in=3600&type=recovery"],
  ["the dead old board path", "/appellation-fleet-board/", "",
   "#access_token=eyJtest&type=recovery",
   APP + "#access_token=eyJtest&type=recovery"],
  ["plain visit, no fragment", "/", "", "", APP],
  ["query string as well", "/", "?foo=1", "#type=recovery&access_token=abc",
   APP + "?foo=1#type=recovery&access_token=abc"],
];

let failed = 0;
for (const [name, pathname, search, hash, want] of cases) {
  let replaced = null;
  const el = { href: null };
  const sandbox = {
    location: { pathname, search, hash, replace: (u) => { replaced = u; } },
    document: { getElementById: () => el },
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);

  const ok = replaced === want && el.href === want;
  if (!ok) failed++;
  console.log("%s  %s", ok ? "ok  " : "FAIL", name);
  if (!ok) {
    console.log("        want: " + want);
    console.log("        got:  " + replaced + "   (link href: " + el.href + ")");
  }
}

// The guard that used to strand people on the dead old path must stay gone.
if (/indexOf\("\/appellation-fleet-board"\)\s*===\s*0/.test(script)) {
  console.log("FAIL  the same-host loop guard is back; it strands the old path");
  failed++;
}

console.log("\n%d cases, %d failed", cases.length, failed);
process.exit(failed ? 1 : 0);
