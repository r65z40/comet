"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Tag, Truck, Clock, Calendar, Monitor } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, formatCountdown, getCountdownColor } from "@/lib/utils";
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

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400">Produit non trouvé</p>
        <button onClick={() => router.back()} className="mt-4 text-primary-400 hover:text-primary-300 text-sm">Retour</button>
      </div>
    );
  }

  const activeInstalls = product.installations.filter((i) => i.status === "EN_PARC_GARANTIE");
  const expiredInstalls = product.installations.filter((i) => i.status === "EN_PARC_HORS_GARANTIE");
  const renewedInstalls = product.installations.filter((i) => i.status === "RENOUVELE");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
          {product.code && <p className="text-sm text-surface-400 mt-1">Code: {product.code}</p>}
        </div>
      </div>

      {/* Infos produit */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
          <h3 className="text-sm font-medium text-surface-400 mb-4">Informations</h3>
          <div className="space-y-3">
            <InfoItem icon={Tag} label="Famille" value={product.family || "—"} />
            <InfoItem icon={Truck} label="Fournisseur" value={product.supplier || "—"} />
            <InfoItem icon={Clock} label="Durée" value={product.durationMonths ? `${product.durationMonths} mois` : "—"} />
            {product.unitPrice != null && (
              <InfoItem icon={Package} label="Prix unitaire" value={`${product.unitPrice.toFixed(2)} \u20ac`} />
            )}
            {product.description && (
              <div>
                <p className="text-xs text-surface-500 mb-1">Description</p>
                <p className="text-sm text-surface-300">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm text-emerald-400 mb-1">En parc garantie</p>
            <p className="text-3xl font-bold text-white">{activeInstalls.length}</p>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="text-sm text-red-400 mb-1">Hors garantie</p>
            <p className="text-3xl font-bold text-white">{expiredInstalls.length}</p>
          </div>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
            <p className="text-sm text-blue-400 mb-1">Renouvelés</p>
            <p className="text-3xl font-bold text-white">{renewedInstalls.length}</p>
          </div>
        </div>
      </div>

      {/* Liste des installations */}
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="h-4 w-4 text-primary-400" />
          <h3 className="text-sm font-medium text-surface-400">
            Installations ({product.installations.length})
          </h3>
        </div>

        {product.installations.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-8">Aucune installation pour ce produit</p>
        ) : (
          <div className="space-y-2">
            {product.installations.map((inst) => (
              <Link
                key={inst.id}
                href={`/installations/${inst.id}`}
                className="flex items-center justify-between rounded-lg border border-surface-700 p-3 hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{inst.client.name}</p>
                    <p className="text-xs text-surface-500">
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
                  <StatusBadge status={inst.status} />
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
      <div className="rounded-lg bg-surface-800 p-2">
        <Icon className="h-4 w-4 text-surface-400" />
      </div>
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-sm font-medium text-surface-200">{value}</p>
      </div>
    </div>
  );
}
