"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { portalLoginAction } from "./actions";

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState("");

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data.company_logo) setCompanyLogo(data.company_logo);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await portalLoginAction(email, password);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      window.location.href = "/portal";
    } catch {
      setError("Erreur de connexion");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" className="mx-auto h-16 object-contain" />
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50">
              <ShieldCheck className="h-7 w-7 text-primary-600" />
            </div>
          )}
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Espace Client</h1>
          <p className="mt-2 text-sm text-slate-500">
            Connectez-vous pour consulter vos garanties
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connexion...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
