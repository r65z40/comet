"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center max-w-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Erreur critique</h2>
            <p className="mt-2 text-sm text-slate-500">
              Un problème inattendu est survenu. Veuillez rafraîchir la page.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-slate-400">Référence : {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Rafraîchir
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
