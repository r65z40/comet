"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Une erreur est survenue</h2>
        <p className="mt-2 text-sm text-slate-500">
          Un problème inattendu s&apos;est produit. Veuillez réessayer ou contacter l&apos;administrateur si le problème persiste.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Référence : {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    </div>
  );
}
