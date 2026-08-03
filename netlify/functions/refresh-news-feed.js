import { createClient } from "@supabase/supabase-js";

const MAX_DEALS = 15;
const MAX_ITEMS_PER_DEAL = 8;
const RECENT_DAYS = 14;
const REQUEST_TIMEOUT_MS = 6000;

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

const parseFlexibleDate = (value) => {
  if (!value) return new Date().toISOString();

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  // Handles compact formats like YYYYMMDDHHMMSS
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/);
  if (match) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
    const isoLike = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    const parsed = new Date(isoLike);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
};

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

const AI_SEARCH_TIMEOUT_MS = 25000;

const fetchAiNewsItems = async (deal) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(`No ANTHROPIC_API_KEY set - skipping AI news search for ${deal.name}`);
    return [];
  }

  const prompt = `Search the web for genuine, recent (last ${RECENT_DAYS} days) news about the company "${deal.name}" (official website: ${deal.company_website}). Do not include results about other companies that just happen to share a similar name.

Respond with ONLY a JSON array (no other text before or after) of up to ${MAX_ITEMS_PER_DEAL} objects, each with fields: "title", "url", "published_date" (YYYY-MM-DD), "summary" (one sentence). If you find no genuine recent news, respond with exactly: []`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_SEARCH_TIMEOUT_MS);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.log(`AI web search failed for ${deal.name}: ${response.status} ${errText}`);
      return [];
    }

    const data = await response.json();
    const blockTypes = (data.content || []).map((b) => b.type).join(",");
    console.log(`AI web search for ${deal.name}: stop_reason=${data.stop_reason}, blocks=[${blockTypes}]`);

    const textBlocks = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const match = textBlocks.match(/\[[\s\S]*\]/);
    if (!match) {
      console.log(`AI web search for ${deal.name}: no JSON array found in response text: ${textBlocks.slice(0, 300)}`);
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (error) {
      console.log(`AI web search for ${deal.name}: JSON parse failed: ${error.message}`);
      return [];
    }

    console.log(`AI web search for ${deal.name}: ${parsed.length} articles found`);

    return parsed
      .filter((article) => article && article.title && article.url)
      .slice(0, MAX_ITEMS_PER_DEAL)
      .map((article) => ({
        deal_id: deal.id,
        deal_name: deal.name,
        title: article.title,
        summary: (article.summary || "").slice(0, 600),
        source_url: article.url,
        source_name: getHostname(article.url),
        published_at: parseFlexibleDate(article.published_date),
        fetched_at: new Date().toISOString(),
        relevance_note: `AI web search match for "${deal.name}"`,
      }));
  } catch (error) {
    console.log(`AI web search error for ${deal.name}: ${error.message}`);
    return [];
  }
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

  const commonPaths = ["/feed", "/rss.xml", "/news/feed"];
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

  const results = await Promise.all(
    feedUrls.map(async (feedUrl) => {
      const xml = await fetchText(feedUrl);
      return parseRssItems(xml, feedUrl, deal);
    })
  );

  return results.flat().slice(0, MAX_ITEMS_PER_DEAL);
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

  console.log(
    "Deals with company_website:",
    (deals || []).map((d) => `${d.name} -> ${d.company_website}`)
  );

  const errors = [];

  const [officialItemsByDeal, aiItemsByDeal] = await Promise.all([
    Promise.all(
      (deals || []).map((deal) =>
        fetchOfficialFeedItems(deal).catch((error) => {
          errors.push({ deal: deal.name, error: `official feed: ${error.message}` });
          return [];
        })
      )
    ),
    Promise.all(
      (deals || []).map((deal) =>
        fetchAiNewsItems(deal).catch((error) => {
          errors.push({ deal: deal.name, error: `ai search: ${error.message}` });
          return [];
        })
      )
    ),
  ]);

  const perDealCounts = await Promise.all(
    (deals || []).map(async (deal, index) => {
      try {
        const officialItems = officialItemsByDeal[index];
        const aiItems = aiItemsByDeal[index];
        const deduped = new Map();

        [...officialItems, ...aiItems].forEach((item) => {
          deduped.set(`${item.deal_id}:${item.source_url}`, item);
        });

        const dealItems = Array.from(deduped.values()).slice(0, MAX_ITEMS_PER_DEAL);

        if (dealItems.length > 0) {
          const { error: upsertError } = await supabase
            .from("news_feed")
            .upsert(dealItems, { onConflict: ["deal_id", "source_url"] });

          if (upsertError) {
            errors.push({ deal: deal.name, error: upsertError.message });
            return 0;
          }
          return dealItems.length;
        }
        return 0;
      } catch (error) {
        errors.push({ deal: deal.name, error: error.message });
        return 0;
      }
    })
  );

  const totalStored = perDealCounts.reduce((sum, n) => sum + n, 0);
  const dealsChecked = (deals || []).length;

  console.log("News feed refresh result:", JSON.stringify({ dealsChecked, totalStored, errors }));

  return jsonResponse(200, {
    success: true,
    dealsChecked,
    dealsTotal: deals?.length || 0,
    articlesStored: totalStored,
    errors,
  });
};
