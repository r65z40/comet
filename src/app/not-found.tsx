import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-300">404</h1>
        <p className="mt-4 text-lg font-medium text-slate-700">Page introuvable</p>
        <p className="mt-2 text-sm text-slate-500">La page que vous cherchez n&apos;existe pas ou a été déplacée.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
