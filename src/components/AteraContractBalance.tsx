"use client";

import { useState } from "react";
import { FileText, Loader2, Clock, ChevronDown } from "lucide-react";

interface ContractTicket {
  ticketId: number;
  ticketNumber: string;
  title: string;
  status: string;
  createdDate: string;
  resolvedDate: string | null;
  workHours: number;
}

interface ContractSummary {
  contractId: number;
  contractName: string;
  contractType: string;
  active: boolean;
  startDate: string;
  endDate: string;
  hoursIncluded: number;
  hoursUsed: number;
  hoursRemaining: number;
  overage: number;
  ticketCount: number;
  tickets: ContractTicket[];
}

interface ContractData {
  summary: {
    totalHoursUsed: number;
    totalHoursRemaining: number;
    totalOverage: number;
  };
  contracts: ContractSummary[];
  unassignedTickets: ContractTicket[];
}

export default function AteraContractBalance({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContractData | null>(null);
  const [expandedContract, setExpandedContract] = useState<number | null>(null);

  async function loadContracts() {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/contracts`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de chargement");
      }
      const json = await res.json();
      setData(json);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function formatHours(h: number) {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h${mins.toString().padStart(2, "0")}`;
  }

  function getUsagePercent(used: number, included: number) {
    if (included === 0) return 0;
    return Math.min(100, Math.round((used / included) * 100));
  }

  function getBarColor(percent: number) {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-indigo-500";
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => { setOpen(!open); if (!loaded) loadContracts(); }}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-2">
            <FileText className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900">Solde contrat Atera</h3>
            <p className="text-xs text-slate-400">Heures consommées et restantes par contrat</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loaded && data && data.contracts.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {data.contracts.length}
            </span>
          )}
          <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-400">Chargement des contrats...</span>
            </div>
          )}

          {!loading && error && (
            <div className="px-6 py-8 text-center text-sm text-slate-400">{error}</div>
          )}

          {!loading && !error && loaded && data && data.contracts.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Aucun contrat trouvé</div>
          )}

          {!loading && data && data.contracts.length > 0 && (
            <div className="p-6 space-y-4">
              {/* Résumé global */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{formatHours(data.summary.totalHoursUsed)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Heures consommées</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{formatHours(data.summary.totalHoursRemaining)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Heures restantes</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className={`text-lg font-bold ${data.summary.totalOverage > 0 ? "text-red-600" : "text-slate-900"}`}>
                    {data.summary.totalOverage > 0 ? `+${formatHours(data.summary.totalOverage)}` : "—"}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Dépassement</p>
                </div>
              </div>

              {/* Contrats individuels */}
              <div className="space-y-3">
                {data.contracts.map((contract) => {
                  const percent = getUsagePercent(contract.hoursUsed, contract.hoursIncluded);
                  const isExpanded = expandedContract === contract.contractId;

                  return (
                    <div key={contract.contractId} className="rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedContract(isExpanded ? null : contract.contractId)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{contract.contractName}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${contract.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {contract.active ? "Actif" : "Inactif"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{contract.contractType}</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {contract.hoursIncluded > 0 && (
                          <>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                              <span>{formatHours(contract.hoursUsed)} / {formatHours(contract.hoursIncluded)}</span>
                              <span className={percent >= 90 ? "text-red-600 font-medium" : ""}>{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${getBarColor(percent)}`}
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>
                          </>
                        )}

                        {contract.hoursIncluded === 0 && (
                          <div className="text-xs text-slate-500">
                            {formatHours(contract.hoursUsed)} consommées — {contract.ticketCount} ticket{contract.ticketCount > 1 ? "s" : ""}
                          </div>
                        )}
                      </button>

                      {isExpanded && contract.tickets.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50/50">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-slate-400">N°</th>
                                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-slate-400">Titre</th>
                                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-slate-400">Statut</th>
                                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Heures</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {contract.tickets.map((t) => (
                                <tr key={t.ticketId} className="hover:bg-slate-50">
                                  <td className="px-4 py-2 text-xs text-slate-500 font-mono">{t.ticketNumber || t.ticketId}</td>
                                  <td className="px-4 py-2 text-xs text-slate-700 max-w-xs truncate">{t.title}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      t.status === "Open" ? "bg-blue-100 text-blue-700" :
                                      t.status === "Pending" ? "bg-amber-100 text-amber-700" :
                                      t.status === "Resolved" ? "bg-emerald-100 text-emerald-700" :
                                      "bg-slate-100 text-slate-600"
                                    }`}>
                                      {t.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-600 text-right font-medium">{formatHours(t.workHours)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {isExpanded && contract.tickets.length === 0 && (
                        <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400">
                          Aucun ticket associé
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tickets non assignés */}
              {data.unassignedTickets.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Tickets hors contrat ({data.unassignedTickets.length})
                  </h4>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full">
                      <tbody className="divide-y divide-slate-100">
                        {data.unassignedTickets.slice(0, 10).map((t) => (
                          <tr key={t.ticketId} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-xs text-slate-500 font-mono">{t.ticketNumber || t.ticketId}</td>
                            <td className="px-4 py-2 text-xs text-slate-700 max-w-xs truncate">{t.title}</td>
                            <td className="px-4 py-2 text-xs text-slate-600 text-right font-medium">{formatHours(t.workHours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.unassignedTickets.length > 10 && (
                      <div className="px-4 py-2 text-center text-[10px] text-slate-400 border-t border-slate-100">
                        +{data.unassignedTickets.length - 10} autres tickets
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
