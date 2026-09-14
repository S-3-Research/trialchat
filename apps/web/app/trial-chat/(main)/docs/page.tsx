import Link from "next/link";
import Image from "next/image";
import docsData from "@/data/docs.json";

export default function DocsPage() {
  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar scroll-mask">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/trial-chat"
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
            Resources & Documents
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Browse and read informational materials about the clinical trial
          </p>
        </div>

        {/* Document Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {docsData.map((doc) => (
            <a
              key={doc.id}
              href={doc.file}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm transition hover:shadow-lg hover:-translate-y-1 hover:border-blue-300 dark:hover:border-blue-500/40"
            >
              {/* Cover Thumbnail */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <Image
                  src={doc.cover}
                  alt={`${doc.title} cover`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
                />
                {/* PDF badge */}
                <span className="absolute top-2 right-2 rounded-md bg-red-600/90 px-2 py-0.5 text-xs font-semibold text-white shadow">
                  PDF
                </span>
              </div>

              {/* Text */}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {doc.title}
                </h3>
                <p className="line-clamp-3 text-xs text-slate-600 dark:text-slate-400">
                  {doc.description}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  Read document
                  <svg
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Developed by S-3 Research LLC
        </div>
      </div>
    </div>
  );
}
