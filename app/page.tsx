import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Sales Copilot
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
            Live sales-call coaching powered by your product knowledge.
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600">
            Upload product information, case studies, value stories,
            battlecards, pricing notes, security FAQs, and objection-handling
            material. Research company websites, then use the live copilot
            during sales calls to surface relevant responses, discovery
            questions, qualification gaps, and next-step guidance.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/library"
              className="rounded-xl border bg-gray-50 p-6 transition hover:bg-gray-100"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Sales Library
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Upload product assets, case studies, value stories, and
                competitive material.
              </p>
            </Link>

            <Link
              href="/company-research"
              className="rounded-xl border bg-gray-50 p-6 transition hover:bg-gray-100"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Company Research
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Scrape a public website and generate structured sales
                intelligence.
              </p>
            </Link>

            <Link
              href="/copilot"
              className="rounded-xl border bg-gray-50 p-6 transition hover:bg-gray-100"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Live Copilot
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Listen to sales conversations and generate live guidance for
                questions, objections, and next steps.
              </p>
            </Link>

            <Link
              href="/calls"
              className="rounded-xl border bg-gray-50 p-6 transition hover:bg-gray-100"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Call Notes
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Review call summaries, pain points, objections, stakeholders,
                and follow-up actions.
              </p>
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-5 text-sm text-gray-600 shadow-sm">
          Use only where transcription, recording, and public website research
          are permitted by company policy and applicable consent laws. Do not
          use this app to bypass logins, paywalls, or private content.
        </div>
      </div>
    </main>
  );
}