"use client";

import { useState } from "react";

type IngestResult = {
  asset_summary?: {
    summary?: string;
    core_value_proposition?: string;
    key_capabilities?: string[];
    differentiators?: string[];
    common_pain_points?: string[];
    business_outcomes?: string[];
  };
  value_stories?: {
    title: string;
    pain_point: string;
    solution: string;
    business_impact: string;
    metrics: string;
  }[];
  discovery_questions?: string[];
  qualification_questions?: string[];
  demo_angles?: string[];
};

export default function SalesLibraryPage() {
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState("Product Overview");
  const [companyOrProduct, setCompanyOrProduct] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [pagesScraped, setPagesScraped] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");

  async function ingestAsset() {
    setLoading(true);
    setError("");
    setSavedMessage("");
    setResult(null);
    setPagesScraped([]);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("assetType", assetType);
      formData.append("companyOrProduct", companyOrProduct);
      formData.append("websiteUrl", websiteUrl);
      formData.append("pastedText", pastedText);

      if (file) {
        formData.append("file", file);
      }

      const response = await fetch("/api/sales/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("Sales ingest error:", data);
        throw new Error(data.error || data.details || "Something went wrong.");
      }

      setResult(data.data);
      setPagesScraped(data.pagesScraped ?? []);
      setSavedMessage(
        `Saved sales asset and ${data.savedValueStories ?? 0} value stories.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  function renderList(items?: string[]) {
    if (!items || items.length === 0) {
      return <p className="text-sm text-gray-500">None found.</p>;
    }

    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Sales Knowledge Library
            </h1>

            <p className="mt-2 max-w-3xl text-gray-600">
              Upload product information, paste sales notes, or scrape public
              website pages. The Sales Copilot will use this library during live
              calls.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/copilot"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Sales Copilot
            </a>

            <a
              href="/calls"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Call Notes
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
                placeholder="Example: Q3 Enterprise Pitch Deck"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Asset Type
              </label>
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
                value={assetType}
                onChange={(event) => setAssetType(event.target.value)}
              >
                <option>Product Overview</option>
                <option>Website Scrape</option>
                <option>Pitch Deck</option>
                <option>Case Study</option>
                <option>Value Story</option>
                <option>Battlecard</option>
                <option>Pricing / Packaging</option>
                <option>Implementation Guide</option>
                <option>Security FAQ</option>
                <option>Objection Handling Guide</option>
                <option>Competitive Comparison</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Company or Product
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
                placeholder="Example: Acme Platform"
                value={companyOrProduct}
                onChange={(event) => setCompanyOrProduct(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 rounded-lg border bg-gray-50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Option 1: Scrape Public Website
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Paste a public website URL. The scraper will read the homepage and
              relevant public pages like product, solutions, pricing, case
              studies, security, and FAQs.
            </p>

            <input
              className="mt-3 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
              placeholder="Example: https://www.example.com"
              value={websiteUrl}
              onChange={(event) => {
                setWebsiteUrl(event.target.value);
                if (event.target.value.trim().length > 0) {
                  setAssetType("Website Scrape");
                }
              }}
            />

            <p className="mt-2 text-xs text-gray-500">
              Use only public pages. Do not use this to bypass logins, paywalls,
              robots restrictions, or private content.
            </p>
          </div>

          <div className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Option 2: Upload File
            </h2>

            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="mt-3 block w-full text-sm text-gray-700"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />

            <p className="mt-1 text-xs text-gray-500">
              Supported files: PDF, DOCX, TXT, MD.
            </p>
          </div>

          <div className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Option 3: Paste Text
            </h2>

            <textarea
              className="mt-3 min-h-[220px] w-full rounded-lg border border-gray-300 p-4 text-sm text-gray-900 outline-none focus:border-gray-900"
              placeholder="Paste product notes, case study text, value story, or battlecard content here..."
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
            />
          </div>

          <button
            onClick={ingestAsset}
            disabled={
              loading ||
              title.trim().length === 0 ||
              assetType.trim().length === 0 ||
              (!file &&
                pastedText.trim().length === 0 &&
                websiteUrl.trim().length === 0)
            }
            className="mt-6 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Analyzing and Saving..." : "Add to Sales Library"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {savedMessage && (
            <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {savedMessage}
            </p>
          )}
        </div>

        {pagesScraped.length > 0 && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Website Pages Added to Library
            </h2>

            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {pagesScraped.map((page) => (
                <li key={page}>{page}</li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div className="mt-6 grid gap-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Asset Summary
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-700">
                {result.asset_summary?.summary}
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Core Value Proposition
                  </h3>
                  <p className="mt-1 text-sm text-gray-700">
                    {result.asset_summary?.core_value_proposition}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Key Capabilities
                  </h3>
                  {renderList(result.asset_summary?.key_capabilities)}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Differentiators
                  </h3>
                  {renderList(result.asset_summary?.differentiators)}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Common Pain Points
                  </h3>
                  {renderList(result.asset_summary?.common_pain_points)}
                </div>
              </div>
            </div>

            {result.value_stories && result.value_stories.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Extracted Value Stories
                </h2>

                <div className="mt-4 grid gap-4">
                  {result.value_stories.map((story, index) => (
                    <div
                      key={`value-story-${index}`}
                      className="rounded-lg bg-gray-50 p-4"
                    >
                      <h3 className="font-semibold text-gray-900">
                        {story.title}
                      </h3>
                      <p className="mt-2 text-sm text-gray-700">
                        <strong>Pain:</strong> {story.pain_point}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        <strong>Solution:</strong> {story.solution}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        <strong>Impact:</strong> {story.business_impact}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        <strong>Metrics:</strong> {story.metrics}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Suggested Discovery Questions
                </h2>
                {renderList(result.discovery_questions)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Qualification Questions
                </h2>
                {renderList(result.qualification_questions)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm md:col-span-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Demo Angles
                </h2>
                {renderList(result.demo_angles)}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}