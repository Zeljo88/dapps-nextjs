import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";

const base = process.env.SEO_BASE_URL || "http://127.0.0.1:3000";
const canonicalOrigin = "https://dappsoncardano.com";

async function get(path, options = {}) {
  const response = await fetch(new URL(path, base), { redirect: "manual", ...options });
  const body = await response.text();
  return { response, body };
}

function getWithHost(path, host) {
  const url = new URL(path, base);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: "GET",
      headers: { host },
    }, response => {
      response.resume();
      response.on("end", () => resolve(response));
    });
    request.on("error", reject);
    request.end();
  });
}

function matchContent(body, pattern, label) {
  const match = body.match(pattern);
  assert.ok(match, `Missing ${label}`);
  return match[1];
}

function canonical(body) {
  return body.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
}

function robots(body) {
  return body.match(/<meta name="robots" content="([^"]+)"/i)?.[1] || "";
}

const canonicalPaths = ["/", "/category", "/category/defi", "/ecosystem", "/yields", "/swap", "/portfolio", "/methodology", "/dapp/minswap", "/dapp/sundaeswap", "/dapp/wingriders"];
for (const path of canonicalPaths) {
  const { response, body } = await get(path);
  assert.equal(response.status, 200, `${path} should return 200`);
  const expected = path === "/" ? canonicalOrigin : `${canonicalOrigin}${path}`;
  assert.equal(canonical(body), expected, `${path} canonical`);
  assert.match(robots(body), /\bindex\b/i, `${path} should be indexable`);
}

const unknownPath = "/dapp/definitely-nonexistent-seo-probe-847293";
const unknown = await get(unknownPath);
assert.equal(unknown.response.status, 404, "Unknown DApp should return 404");
assert.match(robots(unknown.body), /\bnoindex\b/i, "Unknown DApp should be noindex");
assert.equal(canonical(unknown.body), undefined, "Unknown DApp should not emit a canonical URL");

const debug = await get("/api/debug");
assert.equal(debug.response.status, 404, "Debug API route should not exist");

const category = await get("/category/defi");
const categoryTitle = matchContent(category.body, /<title>([^<]+)<\/title>/i, "category title");
assert.equal(categoryTitle, "Cardano DeFi DApps | DApps on Cardano");
assert.equal((categoryTitle.match(/DApps on Cardano/g) || []).length, 1, "Category title should contain branding once");

const categoryIndex = await get("/category");
const categoryIndexTitle = matchContent(categoryIndex.body, /<title>([^<]+)<\/title>/i, "category index title");
assert.equal(categoryIndexTitle, "Cardano DApp Categories | DApps on Cardano");

const sitemap = await get("/sitemap.xml");
assert.equal(sitemap.response.status, 200, "Sitemap should return 200");
const locations = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const dappLocations = locations.filter(url => url.startsWith(`${canonicalOrigin}/dapp/`));
assert.equal(dappLocations.length, 3, "Sitemap should include the three reviewed DApps");
assert.ok(locations.includes(`${canonicalOrigin}/category/defi`), "Sitemap should include category pages");
assert.ok(locations.includes(`${canonicalOrigin}/dapp/minswap`), "Sitemap should include DApp detail pages");
assert.ok(locations.every(url => url === canonicalOrigin || url.startsWith(`${canonicalOrigin}/`)), "Sitemap URLs should use the canonical origin");
assert.doesNotMatch(sitemap.body, /<lastmod>/, "Sitemap should omit synthetic modification timestamps");

const www = await getWithHost("/category/defi", "www.dappsoncardano.com");
assert.equal(www.statusCode, 308, "www should permanently redirect");
assert.equal(www.headers.location, `${canonicalOrigin}/category/defi`, "www should preserve the path");

console.log(`SEO regression checks passed: ${locations.length} sitemap URLs, ${dappLocations.length} DApp URLs.`);

const home = await get("/");
assert.match(home.body, /Partial contract coverage/, "Coverage must be disclosed");
assert.match(home.body, /Observed tx since start/, "Counters must describe observations");
assert.match(home.body, /aria-label="Total TVL: Unavailable"/, "Unknown TVL must remain unavailable in the original UI");
const registryResponse = await fetch(`${process.env.API_URL || "https://api.dappsoncardano.com"}/v1/dapps`);
assert.ok(registryResponse.ok, "Registry should be available for the data-visibility check");
for (const dapp of await registryResponse.json()) {
  if (dapp.observedTransactions === null || dapp.observedTransactions === 0) {
    assert.ok(!home.body.includes(`href="/dapp/${dapp.slug}"`), `${dapp.name} should stay hidden without recorded activity`);
  }
}
const stats = await get("/api/stats");
assert.equal(JSON.parse(stats.body).adaPrice, null, "Unknown price must remain null");
