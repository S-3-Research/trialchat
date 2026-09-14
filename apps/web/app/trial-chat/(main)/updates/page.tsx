import Link from "next/link";
import updatesData from "@/data/updates.json";

export default function UpdatesPage() {
  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar scroll-mask">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center text-sm text-slate-600 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </Link>
          <h1 className="mb-2 text-4xl font-bold text-slate-800 dark:text-white">
            Development Updates
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Track new features, improvements, and known issues
          </p>
        </div>

        {/* Latest Updates Section */}
        <section className="mb-12">
          <h2 className="mb-4 flex items-center text-2xl font-semibold text-slate-800 dark:text-white">
            <svg
              className="mr-2 h-6 w-6 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Latest Updates
          </h2>
          <div className="space-y-4">
            {updatesData.latestUpdates.map((update, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {update.version} - {update.date}
                  </span>
                  {update.isLatest && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Latest
                    </span>
                  )}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {update.title}
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {update.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start">
                      <span className="mr-2 text-green-600 dark:text-green-400">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Features Section */}
        <section className="mb-12">
          <h2 className="mb-4 flex items-center text-2xl font-semibold text-slate-800 dark:text-white">
            <svg
              className="mr-2 h-6 w-6 text-indigo-600 dark:text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Planned Features
          </h2>
          <div className="space-y-3">
            {updatesData.plannedFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-start rounded-lg border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-4"
              >
                <span className="mr-3 mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-600 dark:border-indigo-400"></span>
                <div>
                  <h4 className="font-medium text-slate-800 dark:text-slate-100">
                    {feature.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Known Issues Section */}
        <section>
          <h2 className="mb-4 flex items-center text-2xl font-semibold text-slate-800 dark:text-white">
            <svg
              className="mr-2 h-6 w-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Known Issues
          </h2>
          <div className="glass-panel p-6 text-center">
            <p className="text-slate-600 dark:text-slate-400">No known issues at this time! 🎉</p>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Developed by S-3 Research LLC
        </div>
      </div>
    </div>
  );
}
