const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function visible(chunk) {
  return chunk
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  return blocks;
}

const publicPages = ["index.html", "faq.html", "contact.html", "about.html", "privacy.html", "refund.html", "checkout.html", "order-success.html", "thanks.html", "404.html"];

test("every public page has the analytics snippet once", () => {
  for (const name of publicPages) {
    const html = read(name);
    const hits = html.split('src="/_vercel/insights/script.js"').length - 1;
    assert.strictEqual(hits, 1, name);
  }
  assert.strictEqual(read("app/index.html").includes("/_vercel/insights/script.js"), false);
});

test("indexable pages have one canonical, and private pages are noindex", () => {
  const canonical = {
    "index.html": "https://www.dobi-survival.com/",
    "faq.html": "https://www.dobi-survival.com/faq",
    "contact.html": "https://www.dobi-survival.com/contact",
    "about.html": "https://www.dobi-survival.com/about",
    "privacy.html": "https://www.dobi-survival.com/privacy",
    "refund.html": "https://www.dobi-survival.com/refund"
  };
  for (const [name, href] of Object.entries(canonical)) {
    const html = read(name);
    const found = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((m) => m[1]);
    assert.deepStrictEqual(found, [href], name);
    assert.strictEqual(html.includes('name="robots" content="noindex"'), false, name);
  }
  for (const name of ["checkout.html", "order-success.html", "thanks.html", "404.html"]) {
    assert.strictEqual(read(name).includes('<meta name="robots" content="noindex">'), true, name);
  }
});

test("home JSON-LD uses the standard prices and skips ratings", () => {
  const blocks = jsonLd(read("index.html"));
  assert.strictEqual(blocks.length, 1);
  const raw = JSON.stringify(blocks[0]);
  assert.strictEqual(raw.includes("aggregateRating"), false);
  assert.strictEqual(raw.includes("review"), false);
  assert.strictEqual(raw.includes('"49"'), false);
  assert.strictEqual(raw.includes("$49"), false);
  const graph = blocks[0]["@graph"];
  const os = graph.find((node) => node["@type"] === "SoftwareApplication");
  const ssd = graph.find((node) => node["@type"] === "Product");
  assert.deepStrictEqual(os.offers.map((offer) => offer.price), ["69", "69"]);
  assert.strictEqual(ssd.offers.price, "199");
  assert.strictEqual(os.offers[0].url, "https://dobisurvival.gumroad.com/l/dobi-mac");
  assert.strictEqual(os.offers[1].url, "https://dobisurvival.gumroad.com/l/dobi-windows");
});

test("FAQPage text matches the visible questions and answers", () => {
  const html = read("faq.html");
  const [data] = jsonLd(html);
  const items = [...html.matchAll(/<div class="faq-item">([\s\S]*?)<\/div>\s*(?=\s*<div class="faq-item">|\s*<\/div>)/g)];
  assert.strictEqual(data.mainEntity.length, items.length);
  items.forEach((match, i) => {
    const block = match[1];
    const question = visible(block.match(/<h3>([\s\S]*?)<\/h3>/)[1]);
    const answer = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => visible(p[1])).join(" ");
    assert.strictEqual(data.mainEntity[i].name, question);
    assert.strictEqual(data.mainEntity[i].acceptedAnswer.text, answer);
  });
});

test("sitemap lists the clean indexable URLs and drops checkout", () => {
  const xml = read("sitemap.xml");
  for (const loc of ["https://www.dobi-survival.com/", "https://www.dobi-survival.com/faq", "https://www.dobi-survival.com/contact", "https://www.dobi-survival.com/about", "https://www.dobi-survival.com/privacy", "https://www.dobi-survival.com/refund"]) {
    assert.strictEqual(xml.includes(`<loc>${loc}</loc>`), true, loc);
  }
  assert.strictEqual(xml.includes("index.html"), false);
  assert.strictEqual(xml.includes("checkout"), false);
  assert.strictEqual(xml.includes("<lastmod>2026-11-25</lastmod>"), true);
  assert.strictEqual(xml.includes("2026-11-26"), false);
});

test("local page links point at files that exist", () => {
  const pages = publicPages.filter((name) => name !== "404.html").concat(["404.html"]);
  for (const name of pages) {
    const html = read(name);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const href of hrefs) {
      if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#") || href.startsWith("/")) continue;
      const file = href.split("#")[0].split("?")[0];
      if (!file) continue;
      assert.strictEqual(fs.existsSync(path.join(root, file)), true, `${name} -> ${href}`);
    }
  }
});
