"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, AlertCircle, CheckCircle, FileText, Building2, Package, Calendar } from "lucide-react";

interface Pair {
  orphan: {
    id: string;
    createdAt: string;
    status: string;
    notes: string | null;
    comParc: string | null;
    alwaysInFleet: boolean;
    startDate: string;
    endDate: string;
  };
  linked: {
    id: string;
    createdAt: string;
    status: string;
    notes: string | null;
    comParc: string | null;
    alwaysInFleet: boolean;
    startDate: string;
    endDate: string;
    invoice: { id: string; invoiceNumber: string | null } | null;
  };
  client: { id: string; name: string };
  product: { id: string; name: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onMerged?: () => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DedupInstallationsModal({ open, onClose, onMerged }: Props) {
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState<{ merged: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyse = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sync/dedup-installations");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur d'analyse");
      }
      const data = await res.json();
      setPairs(data.pairs || []);
      // Sélectionner tout par défaut
      setSelected(new Set((data.pairs || []).map((p: Pair) => p.orphan.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'analyse");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) analyse();
  }, [open, analyse]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === pairs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pairs.map((p) => p.orphan.id)));
    }
  }

  async function merge() {
    if (selected.size === 0) return;
    if (!confirm(`Fusionner ${selected.size} doublon(s) ? Les installations orphelines seront archivées (soft-delete, réversible).`)) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/dedup-installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orphanIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de fusion");
      }
      const data = await res.json();
      setResult(data);
      onMerged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de fusion");
    }
    setMerging(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dédoublonnage des installations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paires détectées (orpheline ↔ liée à une facture, même client + produit + dates)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              <span className="ml-3 text-sm text-slate-500">Analyse en cours...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Erreur</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          ) : result ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">
                  {result.merged} doublon(s) fusionné(s) avec succès
                </p>
                {result.failed > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">{result.failed} échec(s) (voir les logs)</p>
                )}
                <p className="text-xs text-emerald-600 mt-1">
                  Les orphelines ont été archivées (soft-delete). Vous pouvez les restaurer depuis la page Installations si besoin.
                </p>
              </div>
            </div>
          ) : pairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-slate-700">Aucun doublon détecté</p>
              <p className="text-xs text-slate-500 mt-1">
                Aucune installation orpheline ne correspond à une installation liée à une facture.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select all */}
              <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded border border-slate-200">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === pairs.length && pairs.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium">
                    {selected.size} / {pairs.length} sélectionnée(s)
                  </span>
                </label>
                <span className="text-xs text-slate-500">
                  {pairs.length} paire(s) détectée(s)
                </span>
              </div>

              {/* Pairs list */}
              {pairs.map((pair) => (
                <div
                  key={pair.orphan.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(pair.orphan.id)}
                      onChange={() => toggle(pair.orphan.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />

                    <div className="flex-1 min-w-0">
                      {/* Header: client + product + dates */}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-2">
                        <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                          <Building2 className="h-4 w-4 text-primary-600" />
                          {pair.client.name}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-slate-700">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          {pair.product.name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(pair.orphan.startDate)} → {formatDate(pair.orphan.endDate)}
                        </span>
                      </div>

                      {/* Two columns: orphan vs linked */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {/* Orphan */}
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-amber-700 uppercase">
                              Orpheline (à archiver)
                            </span>
                            <a
                              href={`/installations/${pair.orphan.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-amber-600 hover:underline"
                            >
                              Voir →
                            </a>
                          </div>
                          <div className="space-y-0.5 text-xs text-slate-700">
                            <div>Status : <span className="font-medium">{pair.orphan.status}</span></div>
                            <div>Créée : {formatDate(pair.orphan.createdAt)}</div>
                            {pair.orphan.comParc && <div>Com. parc : {pair.orphan.comParc}</div>}
                            {pair.orphan.notes && <div className="truncate" title={pair.orphan.notes}>Notes : {pair.orphan.notes}</div>}
                            {pair.orphan.alwaysInFleet && <div className="text-emerald-700">Toujours en parc</div>}
                          </div>
                        </div>

                        {/* Linked (kept) */}
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-emerald-700 uppercase">
                              Liée à facture (conservée)
                            </span>
                            <a
                              href={`/installations/${pair.linked.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-600 hover:underline"
                            >
                              Voir →
                            </a>
                          </div>
                          <div className="space-y-0.5 text-xs text-slate-700">
                            <div>Status : <span className="font-medium">{pair.linked.status}</span></div>
                            <div>Créée : {formatDate(pair.linked.createdAt)}</div>
                            {pair.linked.invoice && (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3 text-slate-400" />
                                Facture {pair.linked.invoice.invoiceNumber || pair.linked.invoice.id}
                              </div>
                            )}
                            {pair.linked.comParc && <div>Com. parc : {pair.linked.comParc}</div>}
                            {pair.linked.notes && <div className="truncate" title={pair.linked.notes}>Notes : {pair.linked.notes}</div>}
                            {pair.linked.alwaysInFleet && <div className="text-emerald-700">Toujours en parc</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            {result
              ? "Fusion terminée."
              : pairs.length > 0
              ? "Les notes, commentaires parc et historique de l'orpheline seront transférés vers l'installation conservée."
              : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {result ? "Fermer" : "Annuler"}
            </button>
            {!result && pairs.length > 0 && (
              <button
                onClick={merge}
                disabled={merging || selected.size === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {merging ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fusion...
                  </>
                ) : (
                  `Fusionner ${selected.size} doublon${selected.size > 1 ? "s" : ""}`
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
