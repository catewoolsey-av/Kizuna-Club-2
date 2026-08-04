import React, { useMemo, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { Badge, Card, Select } from "../../components/ui";

const ensureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
};

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatRelativeTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const getHostname = (url) => {
  try {
    return new URL(ensureUrl(url)).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
};

const NewsFeedView = ({ data }) => {
  const [selectedDealId, setSelectedDealId] = useState("all");
  const fundHoldings = data.fundHoldings || [];
  const newsFeed = data.newsFeed || [];
  const newsFeedStatus = data.newsFeedStatus || {};
  const lastRefreshedLabel = formatRelativeTime(newsFeedStatus.lastRunAt);
  const lastRunAt = newsFeedStatus.lastRunAt ? new Date(newsFeedStatus.lastRunAt).getTime() : null;

  const fundDealIds = useMemo(() => new Set(fundHoldings.map((deal) => deal.id)), [fundHoldings]);
  const filteredItems = newsFeed
    .filter((item) => {
      if (!fundDealIds.has(item.dealId)) return false;
      return selectedDealId === "all" || item.dealId === selectedDealId;
    })
    .map((item) => ({
      ...item,
      isNew: Boolean(lastRunAt && item.created_at && new Date(item.created_at).getTime() >= lastRunAt),
    }));
  const selectedDeal = fundHoldings.find((deal) => deal.id === selectedDealId);
  const holdingsWithoutWebsites = fundHoldings.filter((deal) => !deal.companyWebsite);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Newspaper size={22} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">News Feed</h2>
          </div>
          <p className="text-sm text-gray-600 max-w-3xl">
            Recent company-specific updates for fund holdings. Results are matched against each holding's official website and company name to reduce unrelated coverage from similarly named companies.
          </p>
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <RefreshCw size={15} />
          {lastRefreshedLabel ? `Last refreshed ${lastRefreshedLabel}` : "Refreshes daily"}
        </div>
      </div>

      <div className="max-w-sm">
        <Select
          label="Company"
          value={selectedDealId}
          onChange={setSelectedDealId}
          options={[
            { value: "all", label: "All Companies" },
            ...fundHoldings.map((deal) => ({
              value: deal.id,
              label: deal.companyName,
            })),
          ]}
        />
      </div>

      {selectedDeal && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Official website used for matching</p>
              <p className="font-medium text-gray-900">{selectedDeal.companyWebsite || "No website saved yet"}</p>
            </div>
            {selectedDeal.companyWebsite && (
              <a
                href={ensureUrl(selectedDeal.companyWebsite)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink size={15} />
                Open Website
              </a>
            )}
          </div>
        </Card>
      )}

      {holdingsWithoutWebsites.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add official websites for better matching: {holdingsWithoutWebsites.map((deal) => deal.companyName).join(", ")}.
        </div>
      )}

      {filteredItems.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Newspaper size={30} className="mx-auto text-gray-400 mb-3" />
            <p className="font-medium text-gray-900">No matched news yet</p>
            <p className="text-sm text-gray-500 mt-1">
              New matched updates will appear here after the next daily refresh.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="primary">{item.dealName}</Badge>
                    {item.isNew && <Badge variant="success">New</Badge>}
                    {item.sourceName && (
                      <span className="text-xs text-gray-500">{item.sourceName}</span>
                    )}
                    <span className="text-xs text-gray-500">{formatDate(item.publishedAt)}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  {item.summary && (
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.summary}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-3">
                    Matched using {item.relevanceNote || "company name and official website domain"}
                  </p>
                </div>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
                >
                  <ExternalLink size={15} />
                  {getHostname(item.sourceUrl) || "Open"}
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsFeedView;
