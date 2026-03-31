"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
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
      const res = await fetch("/api/portal/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Erreur inconnue");
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
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
            Réinitialisation du mot de passe
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Email envoy&eacute; !</h2>
              <p className="text-sm text-slate-600">
                Si l&apos;adresse <strong>{email}</strong> correspond &agrave; un compte, vous recevrez un email avec un lien de r&eacute;initialisation.
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Le lien expire dans 1 heure.
              </p>
            </div>
            <Link
              href="/portal/login"
              className="flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour &agrave; la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <p className="text-sm text-slate-500">
              Entrez votre adresse email. Si elle est associ&eacute;e &agrave; un compte, vous recevrez un lien pour r&eacute;initialiser votre mot de passe.
            </p>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Envoyer le lien de réinitialisation"
              )}
            </button>

            <Link
              href="/portal/login"
              className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
