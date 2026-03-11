import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateShort(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "EN_PARC_GARANTIE": return "En parc";
    case "EN_PARC_HORS_GARANTIE": return "Hors parc";
    case "RENOUVELE": return "Hors parc";
    default: return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "EN_PARC_GARANTIE": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "EN_PARC_HORS_GARANTIE": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "RENOUVELE": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function isWarrantyExpired(endDate: Date | string): boolean {
  return daysUntil(endDate) <= 0;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function daysUntil(date: Date | string): number {
  const now = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatCountdown(endDate: Date | string): string {
  const days = daysUntil(endDate);
  if (days < 0) {
    const absDays = Math.abs(days);
    if (absDays > 365) return `Expiré depuis ${Math.floor(absDays / 365)} an(s)`;
    if (absDays > 30) return `Expiré depuis ${Math.floor(absDays / 30)} mois`;
    return `Expiré depuis ${absDays}j`;
  }
  if (days === 0) return "Expire aujourd'hui";
  if (days > 365) return `${Math.floor(days / 365)} an(s) et ${Math.floor((days % 365) / 30)} mois`;
  if (days > 30) return `${Math.floor(days / 30)} mois et ${days % 30}j`;
  return `${days} jours`;
}

export function getCountdownColor(endDate: Date | string): string {
  const days = daysUntil(endDate);
  if (days <= 0) return "text-red-400";
  if (days <= 30) return "text-red-400";
  if (days <= 60) return "text-orange-400";
  if (days <= 90) return "text-amber-400";
  return "text-emerald-400";
}
