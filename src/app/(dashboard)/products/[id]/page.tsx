"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Tag, Truck, Clock, Calendar, Monitor, Trash2, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor, isWarrantyExpired } from "@/lib/utils";
import Link from "next/link";

interface Installation {
  id: string;
  quantity: number;
  startDate: string;
  endDate: string;
  durationMonths: number;
  status: string;
  supplier: string | null;
  family: string | null;
  client: { id: string; name: string };
  invoice: { id: string; invoiceNumber: string | null; invoiceDate: string } | null;
}

interface ProductDetail {
  id: string;
  axonautId: number | null;
  name: string;
  code: string | null;
  description: string | null;
  family: string | null;
  supplier: string | null;
  duration: string | null;
  durationMonths: number | null;
  unitPrice: number | null;
  installations: Installation[];
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id]);

  async function refreshFromAxonaut() {
    if (!product?.axonautId) return;
    setRefreshing(true);
    try {
      await fetch("/api/sync/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "product", axonautId: product.axonautId }),
      });
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      setProduct(data);
    } catch {
      alert("Erreur lors de l'actualisation");
    }
    setRefreshing(false);
  }

  if (loading) return <LoadingSpinner />;
  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Produit non trouvé</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-600 hover:text-primary-700 text-sm">Retour</button>
      </div>
    );
  }

  const activeInstalls = product.installations.filter((i) => i.status === "EN_PARC");
  const expiredInstalls = product.installations.filter((i) => i.status === "HORS_PARC");
  const renewedInstalls = product.installations.filter((i) => i.status === "RENOUVELE");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => router.back()}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{product.name}</h1>
            {product.code && <p className="text-sm text-slate-500 mt-1">Code: {product.code}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {product.axonautId && (
            <button
              onClick={refreshFromAxonaut}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          )}
          <button
            onClick={async () => {
              if (!confirm(`Supprimer le produit "${product.name}" et toutes ses installations associées ?`)) return;
              await fetch(`/api/products/${product.id}`, { method: "DELETE" });
              router.push("/products");
            }}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>

      {/* Infos produit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-medium text-slate-500 mb-4">Informations</h3>
          <div className="space-y-3">
            <InfoItem icon={Tag} label="Famille" value={product.family || "—"} />
            <InfoItem icon={Truck} label="Fournisseur" value={product.supplier || "—"} />
            <InfoItem icon={Clock} label="Durée" value={product.durationMonths ? `${product.durationMonths} mois` : "—"} />
            {product.unitPrice != null && (
              <InfoItem icon={Package} label="Prix unitaire" value={`${product.unitPrice.toFixed(2)} \u20ac`} />
            )}
            {product.description && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Description</p>
                <p className="text-sm text-slate-600">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm text-emerald-600 mb-1">En parc</p>
            <p className="text-3xl font-bold text-slate-900">{activeInstalls.length}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600 mb-1">Hors parc</p>
            <p className="text-3xl font-bold text-slate-900">{expiredInstalls.length}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-sm text-blue-600 mb-1">Renouvelés</p>
            <p className="text-3xl font-bold text-slate-900">{renewedInstalls.length}</p>
          </div>
        </div>
      </div>

      {/* Liste des installations */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="h-4 w-4 text-primary-600" />
          <h3 className="text-sm font-medium text-slate-500">
            Installations ({product.installations.length})
          </h3>
        </div>

        {product.installations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucune installation pour ce produit</p>
        ) : (
          <div className="space-y-2">
            {product.installations.map((inst) => (
              <Link
                key={inst.id}
                href={`/installations/${inst.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{inst.client.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(inst.startDate)} &rarr; {formatDate(inst.endDate)}
                      {inst.invoice?.invoiceNumber && ` | ${inst.invoice.invoiceNumber}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  {inst.status !== "RENOUVELE" && (
                    <span className={`text-xs font-bold ${getCountdownColor(inst.endDate)}`}>
                      {formatCountdown(inst.endDate)}
                    </span>
                  )}
                  <StatusBadge status={inst.status} endDate={inst.endDate} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-slate-100 p-2">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
