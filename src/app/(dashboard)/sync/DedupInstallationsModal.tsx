"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, AlertCircle, CheckCircle, FileText, Building2, Package, Calendar } from "lucide-react";

interface Side {
  id: string;
  createdAt: string;
  status: string;
  notes: string | null;
  comParc: string | null;
  alwaysInFleet: boolean;
  startDate: string;
  endDate: string;
  invoice: { id: string; invoiceNumber: string | null } | null;
  invoiceLineId: string | null;
  historyCount: number;
}

interface Pair {
  victim: Side;
  keeper: Side;
  client: { id: string; name: string };
  product: { id: string; name: string };
  reason: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onMerged?: () => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function SideCard({ side, label, tone }: { side: Side; label: string; tone: "keeper" | "victim" }) {
  const base =
    tone === "keeper"
      ? "border-emerald-200 bg-emerald-50"
      : "border-amber-200 bg-amber-50";
  const accent =
    tone === "keeper" ? "text-emerald-700" : "text-amber-700";
  const link =
    tone === "keeper" ? "text-emerald-600" : "text-amber-600";

  return (
    <div className={`rounded-md border ${base} p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-semibold uppercase ${accent}`}>{label}</span>
        <a
          href={`/installations/${side.id}`}
          target="_blank"
          rel="noreferrer"
          className={`text-[10px] hover:underline ${link}`}
        >
          Voir →
        </a>
      </div>
      <div className="space-y-0.5 text-xs text-slate-700">
        <div>Status : <span className="font-medium">{side.status}</span></div>
        <div>Créée : {formatDate(side.createdAt)}</div>
        {side.invoice ? (
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-slate-400" />
            Facture {side.invoice.invoiceNumber || side.invoice.id}
          </div>
        ) : (
          <div className="text-slate-400 italic">Sans facture</div>
        )}
        {side.comParc && <div>Com. parc : {side.comParc}</div>}
        {side.notes && <div className="truncate" title={side.notes}>Notes : {side.notes}</div>}
        {side.alwaysInFleet && <div className="text-emerald-700">Toujours en parc</div>}
        {side.historyCount > 0 && <div className="text-slate-500">{side.historyCount} entrée(s) d&apos;historique</div>}
      </div>
    </div>
  );
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
      setSelected(new Set((data.pairs || []).map((p: Pair) => p.victim.id)));
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
      setSelected(new Set(pairs.map((p) => p.victim.id)));
    }
  }

  /** Inverse le rôle victim/keeper pour une paire donnée */
  function swapSides(pairIndex: number) {
    setPairs((prev) => {
      const next = [...prev];
      const p = next[pairIndex];
      next[pairIndex] = { ...p, victim: p.keeper, keeper: p.victim };
      return next;
    });
    setSelected((prev) => {
      // Remplacer l'ancien victim.id par le nouveau (si coché)
      const oldVictimId = pairs[pairIndex].victim.id;
      const newVictimId = pairs[pairIndex].keeper.id;
      const next = new Set(prev);
      if (next.has(oldVictimId)) {
        next.delete(oldVictimId);
        next.add(newVictimId);
      }
      return next;
    });
  }

  async function merge() {
    if (selected.size === 0) return;
    if (!confirm(`Fusionner ${selected.size} doublon(s) ? Les installations à archiver seront soft-deleted (réversible).`)) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/dedup-installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ victimIds: Array.from(selected) }),
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dédoublonnage des installations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paires détectées (même client + produit + quantité + dates ±3j)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

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
                  Les installations archivées sont soft-deleted — restaurables depuis la page Installations si besoin.
                </p>
              </div>
            </div>
          ) : pairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-slate-700">Aucun doublon détecté</p>
              <p className="text-xs text-slate-500 mt-1">
                Aucune paire d&apos;installations ne correspond aux critères de similarité.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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

              {pairs.map((pair, idx) => (
                <div
                  key={`${pair.victim.id}-${pair.keeper.id}`}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(pair.victim.id)}
                      onChange={() => toggle(pair.victim.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />

                    <div className="flex-1 min-w-0">
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
                          {formatDate(pair.victim.startDate)} → {formatDate(pair.victim.endDate)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {pair.reason}
                        </span>
                        <button
                          onClick={() => swapSides(idx)}
                          className="ml-auto text-[10px] text-slate-500 hover:text-primary-600 underline"
                          title="Inverser quelle installation est conservée"
                        >
                          Inverser
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <SideCard side={pair.keeper} label="Conservée" tone="keeper" />
                        <SideCard side={pair.victim} label="Archivée" tone="victim" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            {result
              ? "Fusion terminée."
              : pairs.length > 0
              ? "Notes, commentaires parc, historique et toujours-en-parc de l'archivée sont transférés vers la conservée."
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
