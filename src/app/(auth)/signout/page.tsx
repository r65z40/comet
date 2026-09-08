"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";

export default function SignOutPage() {
  const [loading, setLoading] = useState(false);
  const [siteLogo, setSiteLogo] = useState("/logo.svg");

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => { if (data.site_logo) setSiteLogo(data.site_logo); })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    setLoading(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md space-y-8 px-4 text-center">
        <div>
          <img src={siteLogo || "/logo.svg"} alt="COMET" width={56} height={56} className="mx-auto h-14 w-14 rounded-lg" />
          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            COMET <span className="font-light text-primary-600">- CEDELIA</span>
          </h1>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 space-y-6">
          <LogOut className="h-12 w-12 text-slate-400 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Déconnexion</h2>
            <p className="text-sm text-slate-500 mt-2">
              Êtes-vous sûr de vouloir vous déconnecter ?
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Déconnexion...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </>
              )}
            </button>
            <a
              href="/dashboard"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors inline-block"
            >
              Annuler
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
