"use client";

import { useState } from "react";

type CompanyResearch = {
  company_name: string;
  website_url: string;
  company_summary: string;
  what_they_sell: string;
  target_buyers: string[];
  target_industries: string[];
  products_or_services: {
    name: string;
    description: string;
    key_capabilities: string[];
    business_outcomes: string[];
  }[];
  value_proposition: string;
  differentiators: string[];
  common_customer_pain_points: string[];
  business_outcomes: string[];
  proof_points: string[];
  case_studies_or_customers: string[];
  pricing_notes: string;
  implementation_notes: string;
  security_or_compliance_notes: string;
  integrations_or_ecosystem: string[];
  competitors_mentioned: string[];
  likely_objections: {
    objection: string;
    suggested_response: string;
  }[];
  discovery_questions: string[];
  qualification_questions: string[];
  demo_angles: string[];
  follow_up_questions_for_seller: string[];
  open_questions_or_unknowns: string[];
};

export default function CompanyResearchPage() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [pagesScraped, setPagesScraped] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function researchCompany() {
    setLoading(true);
    setError("");
    setResearch(null);
    setPagesScraped([]);

    try {
      const response = await fetch("/api/research-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Company research error:", result);
        throw new Error(result.error || result.details || "Something went wrong.");
      }

      setResearch(result.data);
      setPagesScraped(result.pagesScraped ?? []);
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
              Company Research
            </h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Paste a public company website and generate a structured sales
              research profile for discovery, qualification, demos, objections,
              and follow-up planning.
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
              href="/library"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Sales Library
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">
            Company Website URL
          </label>

          <div className="mt-2 flex flex-col gap-3 md:flex-row">
            <input
              className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
              placeholder="Example: https://www.example.com"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
            />

            <button
              onClick={researchCompany}
              disabled={loading || websiteUrl.trim().length === 0}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loading ? "Researching..." : "Research Company"}
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            This only reads public website pages. It should not be used to
            bypass logins, paywalls, or private content.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {pagesScraped.length > 0 && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Pages Scraped
            </h2>

            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {pagesScraped.map((page) => (
                <li key={page}>{page}</li>
              ))}
            </ul>
          </div>
        )}

        {research && (
          <div className="mt-6 grid gap-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900">
                {research.company_name || "Company Research"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-700">
                {research.company_summary}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    What They Sell
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-800">
                    {research.what_they_sell}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Value Proposition
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-800">
                    {research.value_proposition}
                  </p>
                </div>
              </div>
            </div>

            {research.products_or_services?.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Products / Services
                </h2>

                <div className="mt-4 grid gap-4">
                  {research.products_or_services.map((product, index) => (
                    <div key={`${product.name}-${index}`} className="rounded-lg border p-5">
                      <h3 className="font-semibold text-gray-900">
                        {product.name}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-gray-700">
                        {product.description}
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            Key Capabilities
                          </h4>
                          {renderList(product.key_capabilities)}
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            Business Outcomes
                          </h4>
                          {renderList(product.business_outcomes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Target Buyers
                </h2>
                {renderList(research.target_buyers)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Target Industries
                </h2>
                {renderList(research.target_industries)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Pain Points
                </h2>
                {renderList(research.common_customer_pain_points)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Differentiators
                </h2>
                {renderList(research.differentiators)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Discovery Questions
                </h2>
                {renderList(research.discovery_questions)}
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Qualification Questions
                </h2>
                {renderList(research.qualification_questions)}
              </div>
            </div>

            {research.likely_objections?.length > 0 && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900">
                  Likely Objections
                </h2>

                <div className="mt-4 grid gap-4">
                  {research.likely_objections.map((item, index) => (
                    <div key={`${item.objection}-${index}`} className="rounded-lg bg-gray-50 p-5">
                      <h3 className="font-semibold text-gray-900">
                        {item.objection}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-gray-700">
                        {item.suggested_response}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                Notes
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Pricing Notes
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    {research.pricing_notes || "Unknown"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Implementation Notes
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    {research.implementation_notes || "Unknown"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Security / Compliance Notes
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    {research.security_or_compliance_notes || "Unknown"}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Open Questions
                  </h3>
                  {renderList(research.open_questions_or_unknowns)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}