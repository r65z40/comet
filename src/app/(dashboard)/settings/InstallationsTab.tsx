"use client";

import { useState, useEffect } from "react";
import { Monitor, Loader2, CheckCircle, AlertCircle, Package } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import type { SettingsTabProps } from "./GeneralTab";

interface MissingLine {
  id: string;
  productName: string;
  quantity: number;
  durationMonths: number | null;
}

interface MissingInvoice {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  client: { id: string; name: string };
  lines: MissingLine[];
}

export default function InstallationsTab({ isAdmin }: SettingsTabProps) {
  const [invoices, setInvoices] = useState<MissingInvoice[]>([]);
  const [totalMissing, setTotalMissing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);

  async function fetchMissing() {
    setLoading(true);
    try {
      const res = await fetch("/api/installations/missing");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setTotalMissing(data.totalMissing || 0);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchMissing();
  }, []);

  async function generateAll() {
    if (!confirm(`Générer ${totalMissing} installation(s) manquante(s) ? Cette action est irréversible.`)) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/installations/missing", { method: "POST" });
      const data = await res.json();
      setResult(data);
      await fetchMissing();
    } catch {
      setResult({ created: 0, errors: 1 });
    }
    setGenerating(false);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <Monitor className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Installations manquantes</h3>
              <p className="text-xs text-slate-500">
                Lignes de facture avec un produit mais sans installation générée
              </p>
            </div>
          </div>
          {totalMissing > 0 && isAdmin && (
            <button
              onClick={generateAll}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  Générer {totalMissing} installation{totalMissing > 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>

        {result && (
          <div className={`mx-6 mt-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
            result.errors > 0
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {result.errors > 0 ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0" />
            )}
            {result.created} installation{result.created > 1 ? "s" : ""} créée{result.created > 1 ? "s" : ""}
            {result.errors > 0 && `, ${result.errors} erreur${result.errors > 1 ? "s" : ""}`}
          </div>
        )}

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Toutes les installations sont générées</p>
              <p className="text-xs text-slate-400 mt-1">Aucune ligne de facture en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700 shrink-0"
                      >
                        {inv.invoiceNumber ? `Facture ${inv.invoiceNumber}` : "Facture sans numéro"}
                      </Link>
                      <span className="text-xs text-slate-400">—</span>
                      <Link
                        href={`/clients/${inv.client.id}`}
                        className="text-sm text-slate-600 hover:text-slate-900 truncate"
                      >
                        {inv.client.name}
                      </Link>
                      <span className="text-xs text-slate-400">{formatDate(inv.invoiceDate)}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      {inv.lines.length} manquante{inv.lines.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {inv.lines.map((line) => (
                      <div key={line.id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-700 truncate">{line.productName}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                          <span>Qté: {line.quantity}</span>
                          <span>{line.durationMonths ? `${line.durationMonths} mois` : "12 mois (défaut)"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
