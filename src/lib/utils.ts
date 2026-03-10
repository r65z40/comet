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

export function getInstallationStatus(endDate: Date): "ACTIF" | "BIENTOT_EXPIRE" | "EXPIRE" {
  const now = new Date();
  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "EXPIRE";
  if (diffDays <= 90) return "BIENTOT_EXPIRE";
  return "ACTIF";
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "ACTIF": return "Actif";
    case "BIENTOT_EXPIRE": return "Bientôt expiré";
    case "EXPIRE": return "Expiré";
    default: return status;
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "ACTIF": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "BIENTOT_EXPIRE": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "EXPIRE": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function daysUntil(date: Date | string): number {
  const now = new Date();
  const target = new Date(date);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
