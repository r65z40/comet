"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userName, setUserName] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [siteLogo, setSiteLogo] = useState("/logo.svg");

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => { if (data.site_logo) setSiteLogo(data.site_logo); })
      .catch(() => {});
  }, []);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError("Lien invalide : aucun token fourni.");
      setValidating(false);
      return;
    }

    fetch(`/api/auth/reset-password?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
          setUserName(data.userName || "");
        } else {
          setTokenError(data.error || "Lien invalide ou expiré.");
        }
      })
      .catch(() => setTokenError("Erreur de connexion au serveur."))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
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
          <img src={siteLogo || "/logo.svg"} alt="COMET" width={56} height={56} className="mx-auto h-14 w-14 rounded-lg" />
          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            COMET <span className="font-light text-primary-600">- CEDELIA</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Nouveau mot de passe
          </p>
        </div>

        {validating ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Lien invalide</h2>
              <p className="text-sm text-red-600">{tokenError}</p>
            </div>
            <Link
              href="/forgot-password"
              className="flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Refaire une demande
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Mot de passe modifié !</h2>
              <p className="text-sm text-slate-600">
                Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.
              </p>
            </div>
            <Link
              href="/login"
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              Se connecter
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

            {userName && (
              <p className="text-sm text-slate-500">
                Bonjour <strong>{userName}</strong>, choisissez un nouveau mot de passe.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Min. 8 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirmer le mot de passe
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Confirmer le mot de passe"
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
                  Réinitialisation...
                </>
              ) : (
                "Réinitialiser le mot de passe"
              )}
            </button>

            <Link
              href="/login"
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
