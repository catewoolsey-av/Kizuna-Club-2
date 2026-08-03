const { createClient } = require("@supabase/supabase-js");

const MAX_DEALS = 15;
const MAX_ITEMS_PER_DEAL = 8;
const RECENT_DAYS = 14;
const REQUEST_TIMEOUT_MS = 10000;

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const ensureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
};

const getHostname = (url) => {
  try {
    return new URL(ensureUrl(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_) {
    return "";
  }
};

const getDomainStem = (hostname) => hostname.split(".")[0] || "";

const normalizeText = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getRecentCutoff = () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  return cutoff;
};

const isRecentDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date >= getRecentCutoff();
};

const getCompanyTokens = (companyName) => {
  const legalSuffixes = new Set([
    "ai",
    "inc",
    "llc",
    "ltd",
    "corp",
    "corporation",
    "co",
    "company",
    "technologies",
    "technology",
  ]);
  return normalizeText(companyName)
    .split(" ")
    .filter((token) => token.length > 2 && !legalSuffixes.has(token));
};

const significantMatch = (text, companyName, websiteHost) => {
  const normalized = normalizeText(text);
  const normalizedName = normalizeText(companyName);
  const tokens = getCompanyTokens(companyName);
  const hostStem = getDomainStem(websiteHost);

  const exactNameMatch = normalized.includes(normalizedName);
  const tokenMatches = tokens.filter((token) => normalized.includes(token)).length;
  const domainMatch =
    !!websiteHost && (normalized.includes(websiteHost) || (!!hostStem && normalized.includes(hostStem)));

  if (exactNameMatch && tokens.length > 1) return true;
  if (tokens.length > 1 && tokenMatches >= Math.min(tokens.length, 2) && domainMatch) return true;
  if (tokens.length === 1 && exactNameMatch && domainMatch) return true;
  return false;
};

const fetchText = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "KizunaClubNewsBot/1.0",
        Accept: "text/html,application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) return "";
    return await response.text();
  } catch (_) {
    return "";
  } finally {
    clearTimeout(timeout);
  }
};

const stripTags = (value) => (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const absoluteUrl = (baseUrl, href) => {
  try {
    return new URL(href, baseUrl).toString();
  } catch (_) {
    return "";
  }
};

const discoverFeedUrls = async (websiteUrl) => {
  const html = await fetchText(websiteUrl);
  const discovered = [];
  const linkRegex = /<link[^>]+(?:type=["']application\/(?:rss|atom)\+xml["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*type=["']application\/(?:rss|atom)\+xml["'])/gi;
  let match;

  while ((match = linkRegex.exec(html))) {
    discovered.push(absoluteUrl(websiteUrl, match[1] || match[2]));
  }

  const commonPaths = ["/feed", "/rss", "/rss.xml", "/atom.xml", "/news/feed", "/blog/feed"];
  for (const path of commonPaths) {
    discovered.push(absoluteUrl(websiteUrl, path));
  }

  return Array.from(new Set(discovered.filter(Boolean))).slice(0, 8);
};

const parseRssItems = (xml, feedUrl, deal) => {
  const websiteHost = getHostname(deal.company_website);
  const sourceHost = getHostname(feedUrl);
  if (!xml || sourceHost !== websiteHost) return [];

  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
  return itemBlocks
    .map((block) => {
      const title = stripTags((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
      const summary = stripTags(
        (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
          block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
          [])[1]
      );
      const linkMatch =
        block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i) ||
        block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const sourceUrl = absoluteUrl(feedUrl, stripTags((linkMatch || [])[1]));
      const published =
        stripTags((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
          block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
          block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
          [])[1]) || null;

      if (!title || !sourceUrl || !isRecentDate(published)) return null;

      return {
        deal_id: deal.id,
        deal_name: deal.name,
        title,
        summary: summary.slice(0, 600),
        source_url: sourceUrl,
        source_name: websiteHost,
        published_at: published ? new Date(published).toISOString() : new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        relevance_note: `official website: ${websiteHost}`,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS_PER_DEAL);
};

const fetchOfficialFeedItems = async (deal) => {
  const websiteUrl = ensureUrl(deal.company_website);
  const feedUrls = await discoverFeedUrls(websiteUrl);
  const allItems = [];

  for (const feedUrl of feedUrls) {
    const xml = await fetchText(feedUrl);
    allItems.push(...parseRssItems(xml, feedUrl, deal));
    if (allItems.length >= MAX_ITEMS_PER_DEAL) break;
  }

  return allItems.slice(0, MAX_ITEMS_PER_DEAL);
};

const fetchGdeltItems = async (deal) => {
  const websiteHost = getHostname(deal.company_website);
  if (!websiteHost) return [];

  const query = `"${deal.name}"`;
  const gdeltUrl = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  gdeltUrl.searchParams.set("query", query);
  gdeltUrl.searchParams.set("mode", "ArtList");
  gdeltUrl.searchParams.set("format", "json");
  gdeltUrl.searchParams.set("maxrecords", "20");
  gdeltUrl.searchParams.set("sort", "DateDesc");
  gdeltUrl.searchParams.set("timespan", `${RECENT_DAYS}d`);

  let payload;
  try {
    const response = await fetch(gdeltUrl.toString(), {
      headers: { "User-Agent": "KizunaClubNewsBot/1.0" },
    });
    if (!response.ok) return [];
    payload = await response.json();
  } catch (_) {
    return [];
  }

  const articles = Array.isArray(payload?.articles) ? payload.articles : [];
  const candidates = [];

  for (const article of articles) {
    const sourceUrl = article.url;
    const title = article.title || "";
    if (!sourceUrl || !title) continue;

    const sourceHost = getHostname(sourceUrl);
    const body = await fetchText(sourceUrl);
    const validationText = [title, article.seendate, article.sourceCollection, sourceHost, body.slice(0, 12000)].join(" ");

    if (!significantMatch(validationText, deal.name, websiteHost)) continue;

    candidates.push({
      deal_id: deal.id,
      deal_name: deal.name,
      title,
      summary: stripTags(body).slice(0, 600),
      source_url: sourceUrl,
      source_name: article.domain || sourceHost,
      published_at: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      relevance_note: `matched "${deal.name}" with ${websiteHost}`,
    });

    if (candidates.length >= MAX_ITEMS_PER_DEAL) break;
  }

  return candidates;
};

export const handler = async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: deals, error: dealsError } = await supabase
    .from("fund_holdings")
    .select("id, name, sector, company_website, sort_order")
    .not("company_website", "is", null)
    .order("sort_order", { ascending: true })
    .limit(MAX_DEALS);

  if (dealsError) {
    return jsonResponse(500, { error: dealsError.message });
  }

  const collected = [];
  const errors = [];

  for (const deal of deals || []) {
    try {
      const officialItems = await fetchOfficialFeedItems(deal);
      const gdeltItems = await fetchGdeltItems(deal);
      const deduped = new Map();

      [...officialItems, ...gdeltItems].forEach((item) => {
        deduped.set(`${item.deal_id}:${item.source_url}`, item);
      });

      collected.push(...Array.from(deduped.values()).slice(0, MAX_ITEMS_PER_DEAL));
    } catch (error) {
      errors.push({ deal: deal.name, error: error.message });
    }
  }

  if (collected.length > 0) {
    const { error: upsertError } = await supabase
      .from("news_feed")
      .upsert(collected, { onConflict: ["deal_id", "source_url"] });

    if (upsertError) {
      return jsonResponse(500, { error: upsertError.message, collected: collected.length });
    }
  }

  return jsonResponse(200, {
    success: true,
    dealsChecked: deals?.length || 0,
    articlesStored: collected.length,
    errors,
  });
};
