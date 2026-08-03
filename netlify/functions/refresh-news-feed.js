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

const judgeRelevanceWithAI = async (deal, candidates) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(`No ANTHROPIC_API_KEY set - skipping AI relevance check for ${deal.name}`);
    return candidates.map(() => false);
  }
  if (candidates.length === 0) return [];

  const list = candidates
    .map((c, i) => `${i}. "${c.title}" (source: ${c.domain || getHostname(c.url)}, date: ${c.seendate || "unknown"})`)
    .join("\n");

  const prompt = `Company: "${deal.name}" (official website: ${deal.company_website})

Below is a numbered list of news article headlines found via keyword search. Some may be about unrelated companies that just share a similar name. Return ONLY a JSON array of the indices (numbers) that are genuinely about this specific company, e.g. [0,2,5]. If none are relevant, return [].

${list}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.log(`AI relevance call failed for ${deal.name}: ${response.status} ${errText}`);
      return candidates.map(() => false);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "[]";
    const match = text.match(/\[[\d,\s]*\]/);
    const relevantIndices = new Set(match ? JSON.parse(match[0]) : []);
    console.log(`AI relevance for ${deal.name}: ${relevantIndices.size}/${candidates.length} matched`);
    return candidates.map((_, i) => relevantIndices.has(i));
  } catch (error) {
    console.log(`AI relevance error for ${deal.name}: ${error.message}`);
    return candidates.map(() => false);
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
    if (!response.ok) {
      console.log(`GDELT request failed for ${deal.name}: ${response.status}`);
      return [];
    }
    payload = await response.json();
  } catch (error) {
    console.log(`GDELT request error for ${deal.name}: ${error.message}`);
    return [];
  }

  const articles = (Array.isArray(payload?.articles) ? payload.articles : [])
    .filter((article) => article.url && article.title)
    .slice(0, 20);

  console.log(`GDELT candidates for ${deal.name}: ${articles.length}`);
  if (articles.length === 0) return [];

  const relevanceFlags = await judgeRelevanceWithAI(deal, articles);
  const relevantArticles = articles.filter((_, i) => relevanceFlags[i]).slice(0, MAX_ITEMS_PER_DEAL);

  const items = await Promise.all(
    relevantArticles.map(async (article) => {
      const sourceHost = getHostname(article.url);
      const body = await fetchText(article.url);
      return {
        deal_id: deal.id,
        deal_name: deal.name,
        title: article.title,
        summary: stripTags(body).slice(0, 600),
        source_url: article.url,
        source_name: article.domain || sourceHost,
        published_at: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        relevance_note: `AI-matched to "${deal.name}"`,
      };
    })
  );

  return items;
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

  // GDELT rate-limits concurrent requests, so official feeds run in parallel
  // per-deal, but GDELT lookups are done in a single staggered pass below.
  const officialItemsByDeal = await Promise.all(
    (deals || []).map((deal) => fetchOfficialFeedItems(deal))
  );

  const gdeltItemsByDeal = [];
  for (const deal of deals || []) {
    gdeltItemsByDeal.push(await fetchGdeltItems(deal));
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const perDealCounts = await Promise.all(
    (deals || []).map(async (deal, index) => {
      try {
        const officialItems = officialItemsByDeal[index];
        const gdeltItems = gdeltItemsByDeal[index];
        const deduped = new Map();

        [...officialItems, ...gdeltItems].forEach((item) => {
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
