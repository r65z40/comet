import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function ArticleNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <FileQuestion className="h-6 w-6 text-slate-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Article introuvable</h2>
        <p className="mt-2 text-sm text-slate-500">
          Cet article n&apos;existe pas ou a été supprimé.
        </p>
        <Link
          href="/knowledge"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Retour à la base de connaissances
        </Link>
      </div>
    </div>
  );
}
