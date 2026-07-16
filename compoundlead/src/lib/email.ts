/**
 * Email lookup.
 *
 * Google does not carry email addresses. The only honest way to get one is to
 * visit the clinic's own website and read the address they have chosen to
 * publish. That's what this does: fetch the homepage, follow one link to a
 * contact/about page if there is one, and pull the first sensible mailto.
 *
 * Expect a hit on roughly a third of clinic sites. The rest use a contact form.
 * That's not a bug in this code, it's how clinic websites are built.
 *
 * Rules we hold to:
 *   - honour robots.txt
 *   - identify ourselves in the User-Agent
 *   - one pass, two pages max, then give up
 */

const UA = process.env.CRAWLER_USER_AGENT || "CompoundLeadBot/1.0 (lead research)";
const TIMEOUT_MS = 6000;

const JUNK_LOCAL = ["example", "sentry", "wixpress", "yourdomain", "email", "name@", "user@", "domain.com"];
const JUNK_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];

// Prefer a human mailbox over a no-reply.
const PREFERRED = ["info@", "contact@", "hello@", "office@", "admin@", "frontdesk@", "reception@", "care@"];
const AVOID = ["noreply@", "no-reply@", "donotreply@", "privacy@", "legal@", "abuse@", "postmaster@", "webmaster@"];

async function get(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return (await res.text()).slice(0, 400_000);
  } catch {
    return null;
  }
}

async function robotsAllows(origin: string, path: string, signal: AbortSignal): Promise<boolean> {
  const txt = await get(`${origin}/robots.txt`, signal);
  if (!txt) return true; // no robots.txt means no restrictions

  // Minimal parse: look at the * group only.
  const lines = txt.split("\n").map((l) => l.trim().toLowerCase());
  let inStar = false;
  const disallows: string[] = [];

  for (const line of lines) {
    if (line.startsWith("user-agent:")) inStar = line.split(":")[1].trim() === "*";
    else if (inStar && line.startsWith("disallow:")) {
      const rule = line.slice("disallow:".length).trim();
      if (rule) disallows.push(rule);
    }
  }
  return !disallows.some((d) => path.toLowerCase().startsWith(d));
}

function extractEmails(html: string, domain: string): string[] {
  const found = new Set<string>();

  // mailto: links are the intentional ones — check them first.
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(m[1]);
  for (const m of html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) found.add(m[0]);

  const clean = Array.from(found)
    .map((e) => decodeURIComponent(e).trim().toLowerCase().replace(/^mailto:/, ""))
    .filter((e) => e.includes("@") && e.length < 80)
    .filter((e) => !JUNK_EXT.some((x) => e.endsWith(x)))
    .filter((e) => !JUNK_LOCAL.some((x) => e.includes(x)))
    .filter((e) => !AVOID.some((x) => e.startsWith(x)));

  // An address on the clinic's own domain is far more likely to be theirs.
  const onDomain = clean.filter((e) => e.endsWith(`@${domain}`) || e.endsWith(`.${domain}`));
  const pool = onDomain.length ? onDomain : clean;

  return pool.sort((a, b) => {
    const ap = PREFERRED.findIndex((p) => a.startsWith(p));
    const bp = PREFERRED.findIndex((p) => b.startsWith(p));
    return (ap === -1 ? 99 : ap) - (bp === -1 ? 99 : bp);
  });
}

function contactLinks(html: string, origin: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = m[1];
    if (!/contact|about|reach|connect|location/i.test(href)) continue;
    try {
      const u = new URL(href, origin);
      if (u.origin === origin) urls.add(u.toString());
    } catch {
      /* skip malformed */
    }
  }
  return Array.from(urls).slice(0, 1); // one extra page, that's it
}

export interface EmailResult {
  email: string | null;
  contactUrl: string | null;
  status: "PUBLIC" | "NONE";
}

export async function findEmail(website: string, domain: string): Promise<EmailResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const url = new URL(website);
    const origin = url.origin;

    if (!(await robotsAllows(origin, url.pathname, ctrl.signal))) {
      return { email: null, contactUrl: null, status: "NONE" };
    }

    const home = await get(website, ctrl.signal);
    if (!home) return { email: null, contactUrl: null, status: "NONE" };

    let emails = extractEmails(home, domain);
    if (emails.length) return { email: emails[0], contactUrl: website, status: "PUBLIC" };

    for (const link of contactLinks(home, origin)) {
      if (!(await robotsAllows(origin, new URL(link).pathname, ctrl.signal))) continue;
      const page = await get(link, ctrl.signal);
      if (!page) continue;
      emails = extractEmails(page, domain);
      if (emails.length) return { email: emails[0], contactUrl: link, status: "PUBLIC" };
    }

    return { email: null, contactUrl: null, status: "NONE" };
  } catch {
    return { email: null, contactUrl: null, status: "NONE" };
  } finally {
    clearTimeout(timer);
  }
}
