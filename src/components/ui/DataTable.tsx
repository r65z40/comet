"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  rowClassName?: (item: T) => string;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

function getNestedValue(obj: unknown, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const PER_PAGE_OPTIONS = [20, 40, 60, 100];

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  page,
  totalPages,
  onPageChange,
  onRowClick,
  isLoading,
  rowClassName,
  perPage,
  onPerPageChange,
  selectable,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = getNestedValue(a, sortKey);
      const valB = getNestedValue(b, sortKey);
      const strA = valA != null ? String(valA).toLowerCase() : "";
      const strB = valB != null ? String(valB).toLowerCase() : "";
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && strA !== "" && strB !== "") {
        return sortDir === "asc" ? numA - numB : numB - numA;
      }
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDir]);

  const allSelected = selectable && data.length > 0 && data.every((item) => selectedIds?.has(item.id));

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map((item) => item.id)));
    }
  }

  function toggleOne(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {selectable && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 ${
                    col.sortable !== false ? "cursor-pointer select-none hover:text-slate-700 transition-colors" : ""
                  }`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && (
                      sortKey === col.key ? (
                        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-8 text-center text-sm text-slate-500">
                  Aucune donnée disponible
                </td>
              </tr>
            ) : (
              sortedData.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-slate-50 ${onRowClick ? "cursor-pointer" : ""} ${selectedIds?.has(item.id) ? "bg-primary-50/50" : ""} ${rowClassName ? rowClassName(item) : ""}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {selectable && (
                    <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(item.id) || false}
                        onChange={() => toggleOne(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              Page {page} sur {totalPages}
            </p>
            {onPerPageChange && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-400">Afficher</label>
                <select
                  value={perPage || 40}
                  onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1); }}
                  className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 focus:border-primary-500 focus:outline-none"
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          )}
        </div>
    </div>
  );
}
