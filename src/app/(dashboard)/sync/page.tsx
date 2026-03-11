"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader2, Play, Zap, Bug } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SyncLog {
  id: string;
  type: string;
  status: string;
  message: string | null;
  itemCount: number;
  startedAt: string;
  completedAt: string | null;
}

interface DebugData {
  database: {
    products: { total: number; withDuration: number; withoutDuration: number };
    clients: { total: number };
    invoices: { total: number };
    invoiceLines: { total: number; withProduct: number; withoutProduct: number };
    installations: { total: number };
  };
  samples: {
    productsWithDuration: { name: string; durationMonths: number; duration: string | null }[];
    productsWithoutDuration: { name: string; durationMonths: number | null; duration: string | null }[];
    orphanLines: { description: string | null }[];
  };
  axonautApiStructure: Record<string, unknown> | null;
}

const syncTypes = [
  { type: "products", label: "Produits", description: "Synchroniser les produits depuis Axonaut" },
  { type: "clients", label: "Clients", description: "Synchroniser les clients depuis Axonaut" },
  { type: "invoices", label: "Factures", description: "Synchroniser les factures et lignes de factures" },
  { type: "installations", label: "Installations", description: "Générer les installations à partir des factures" },
  { type: "statuses", label: "Statuts", description: "Mettre à jour les statuts des installations" },
];

export default function SyncPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugData | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [loadingDebug, setLoadingDebug] = useState(false);

  async function fetchLogs() {
    const res = await fetch("/api/sync");
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  async function handleSync(type: string) {
    setSyncing(type);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Erreur: ${data.error || "Erreur inconnue"}`);
      }
      await fetchLogs();
    } catch {
      // Error handled via logs
    }
    setSyncing(null);
  }

  async function handleFullSync() {
    setSyncing("full");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Erreur: ${data.error || "Erreur inconnue"}`);
      }
      await fetchLogs();
    } catch {
      // Error handled via logs
    }
    setSyncing(null);
  }

  async function fetchDebug() {
    setLoadingDebug(true);
    try {
      const res = await fetch("/api/sync/debug");
      const data = await res.json();
      setDebug(data);
      setShowDebug(true);
    } catch {
      alert("Erreur lors du diagnostic");
    }
    setLoadingDebug(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Synchronisation</h1>
          <p className="text-sm text-surface-400 mt-1">Gérer la synchronisation avec Axonaut</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDebug}
            disabled={loadingDebug}
            className="flex items-center gap-2 rounded-lg border border-surface-700 px-4 py-2.5 text-sm font-medium text-surface-300 hover:bg-surface-800 disabled:opacity-50 transition-colors"
          >
            {loadingDebug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
            Diagnostic
          </button>
          <button
            onClick={handleFullSync}
            disabled={syncing !== null}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {syncing === "full" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Synchronisation complète
          </button>
        </div>
      </div>

      {/* Panneau de diagnostic */}
      {showDebug && debug && (
        <div className="rounded-xl border border-amber-500/30 bg-surface-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-amber-400">Diagnostic de la base de données</h3>
            <button onClick={() => setShowDebug(false)} className="text-xs text-surface-400 hover:text-surface-200">
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <DiagCard label="Produits" value={debug.database.products.total} sub={`${debug.database.products.withDuration} avec durée`} />
            <DiagCard label="Clients" value={debug.database.clients.total} />
            <DiagCard label="Factures" value={debug.database.invoices.total} />
            <DiagCard label="Lignes factures" value={debug.database.invoiceLines.total} sub={`${debug.database.invoiceLines.withProduct} liées, ${debug.database.invoiceLines.withoutProduct} orphelines`} />
            <DiagCard label="Installations" value={debug.database.installations.total} />
          </div>

          {debug.database.products.withDuration === 0 && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-sm text-red-400 font-medium">Aucun produit n&apos;a de durée en mois renseignée !</p>
              <p className="text-xs text-surface-400 mt-1">
                Vérifiez que vos produits dans Axonaut ont un champ personnalisé &quot;Durée en mois&quot; rempli.
              </p>
            </div>
          )}

          {debug.database.invoiceLines.withoutProduct > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-sm text-amber-400 font-medium">{debug.database.invoiceLines.withoutProduct} ligne(s) de facture sans produit lié</p>
              <p className="text-xs text-surface-400 mt-1">
                Ces lignes ne généreront pas d&apos;installation. Vérifiez que les produits Axonaut ont un ID cohérent.
              </p>
            </div>
          )}

          {debug.axonautApiStructure && (
            <details className="text-xs">
              <summary className="text-surface-400 cursor-pointer hover:text-surface-200">
                Structure API Axonaut (données brutes)
              </summary>
              <pre className="mt-2 rounded-lg bg-surface-800 p-3 text-surface-300 overflow-auto max-h-80">
                {JSON.stringify(debug.axonautApiStructure, null, 2)}
              </pre>
            </details>
          )}

          {debug.samples.productsWithDuration.length > 0 && (
            <details className="text-xs">
              <summary className="text-surface-400 cursor-pointer hover:text-surface-200">
                Produits avec durée ({debug.database.products.withDuration})
              </summary>
              <pre className="mt-2 rounded-lg bg-surface-800 p-3 text-surface-300 overflow-auto max-h-40">
                {JSON.stringify(debug.samples.productsWithDuration, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {syncTypes.map((st) => (
          <div key={st.type} className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">{st.label}</h3>
              <button
                onClick={() => handleSync(st.type)}
                disabled={syncing !== null}
                className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:bg-surface-800 hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                {syncing === st.type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-surface-400">{st.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800">
          <h3 className="text-sm font-medium text-surface-400">Historique de synchronisation</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Message</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Éléments</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-surface-500">
                    Aucun historique de synchronisation
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-surface-200 capitalize">{log.type}</td>
                    <td className="px-4 py-3">
                      {log.status === "success" ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle className="h-3.5 w-3.5" /> Succès
                        </span>
                      ) : log.status === "error" ? (
                        <span className="flex items-center gap-1.5 text-xs text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> Erreur
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-amber-400">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> En cours
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-400 max-w-md">
                      <span className="block truncate" title={log.message || ""}>{log.message}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-300">{log.itemCount}</td>
                    <td className="px-4 py-3 text-sm text-surface-400">{formatDate(log.startedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DiagCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-800 p-3 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-surface-400">{label}</p>
      {sub && <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  );
}
