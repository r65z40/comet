import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAxonautConfig, rateLimitedFetch } from "@/lib/axonaut";

interface EndpointResult {
  name: string;
  endpoint: string;
  status: "ok" | "error" | "empty";
  count?: number;
  sample?: Record<string, unknown>;
  fields?: string[];
  error?: string;
  financialSummary?: Record<string, unknown>;
}

async function probeEndpoint(
  apiUrl: string,
  apiKey: string,
  name: string,
  endpoint: string,
  opts?: { extractFinancials?: (items: Record<string, unknown>[]) => Record<string, unknown> },
): Promise<EndpointResult> {
  try {
    const url = `${apiUrl}${endpoint}${endpoint.includes("?") ? "&" : "?"}page=1`;
    const res = await rateLimitedFetch(url, apiKey);

    if (!res.ok) {
      return { name, endpoint, status: "error", error: `HTTP ${res.status}` };
    }

    const data = await res.json();

    const items = Array.isArray(data) ? data : null;
    if (!items || items.length === 0) {
      return { name, endpoint, status: "empty", count: 0 };
    }

    const sample = items[0] as Record<string, unknown>;
    const fields = Object.keys(sample);

    const result: EndpointResult = {
      name,
      endpoint,
      status: "ok",
      count: items.length,
      fields,
      sample: sanitizeSample(sample),
    };

    if (opts?.extractFinancials && items.length > 0) {
      result.financialSummary = opts.extractFinancials(items as Record<string, unknown>[]);
    }

    return result;
  } catch (err) {
    return { name, endpoint, status: "error", error: String(err) };
  }
}

function sanitizeSample(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (Array.isArray(value)) {
      result[key] = `[Array: ${value.length} items]`;
    } else if (typeof value === "object") {
      result[key] = `{Object: ${Object.keys(value as Record<string, unknown>).join(", ")}}`;
    } else if (typeof value === "string" && value.length > 100) {
      result[key] = value.slice(0, 100) + "...";
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { apiKey, apiUrl } = await getAxonautConfig();
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Axonaut non configurée" }, { status: 400 });
  }

  const endpoints: EndpointResult[] = [];

  const probes = [
    {
      name: "Entreprises (Clients)",
      endpoint: "/companies",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => ({
          total: items.length,
          withEmail: items.filter((i) => i.email).length,
        }),
      },
    },
    {
      name: "Contacts",
      endpoint: "/employees",
    },
    {
      name: "Factures",
      endpoint: "/invoices",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => {
          let totalHT = 0;
          let totalTTC = 0;
          const statuses: Record<string, number> = {};
          const purchasePriceFields: Record<string, number> = {};

          for (const inv of items) {
            totalHT += Number(inv.pre_tax_amount ?? inv.amount ?? 0);
            totalTTC += Number(inv.total_amount ?? inv.amount ?? 0);
            const s = String(inv.status ?? "inconnu");
            statuses[s] = (statuses[s] || 0) + 1;

            if (inv.paid !== undefined) {
              const paidKey = `paid=${String(inv.paid)}`;
              statuses[paidKey] = (statuses[paidKey] || 0) + 1;
            }
            if (inv.is_paid !== undefined) {
              const isPaidKey = `is_paid=${String(inv.is_paid)}`;
              statuses[isPaidKey] = (statuses[isPaidKey] || 0) + 1;
            }

            const lines = (inv.lines || inv.invoice_lines || inv.products || []) as Record<string, unknown>[];
            for (const line of lines) {
              for (const key of Object.keys(line)) {
                const kl = key.toLowerCase();
                if (kl.includes("purchase") || kl.includes("cost") || kl.includes("buying") || kl.includes("achat")) {
                  const val = Number(line[key] ?? 0);
                  purchasePriceFields[key] = (purchasePriceFields[key] || 0) + (val > 0 ? 1 : 0);
                }
              }
            }
          }

          const result: Record<string, unknown> = { totalHT, totalTTC, statuses, sampleCount: items.length };

          if (Object.keys(purchasePriceFields).length > 0) {
            result["champsAchat (lignes)"] = purchasePriceFields;
          } else {
            result["champsAchat (lignes)"] = "Aucun champ d'achat trouvé";
          }

          const firstInv = items[0] as Record<string, unknown>;
          const firstLines = (firstInv?.lines || firstInv?.invoice_lines || firstInv?.products || []) as Record<string, unknown>[];
          if (firstLines[0]) {
            result["champsLigne"] = Object.keys(firstLines[0]);
          }

          return result;
        },
      },
    },
    {
      name: "Devis (Quotations)",
      endpoint: "/quotations",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => {
          let total = 0;
          const statuses: Record<string, number> = {};
          for (const q of items) {
            total += Number(q.pre_tax_amount ?? q.amount ?? 0);
            const s = String(q.status ?? "inconnu");
            statuses[s] = (statuses[s] || 0) + 1;
          }
          return { totalHT: total, statuses, sampleCount: items.length };
        },
      },
    },
    {
      name: "Avoirs (Credit notes)",
      endpoint: "/creditnotes",
    },
    {
      name: "Dépenses (Expenses)",
      endpoint: "/expenses",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => {
          let total = 0;
          for (const e of items) {
            total += Number(e.pre_tax_amount ?? e.amount ?? 0);
          }
          return { totalHT: total, sampleCount: items.length };
        },
      },
    },
    {
      name: "Paiements (Payments)",
      endpoint: "/payments",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => {
          let total = 0;
          for (const p of items) {
            total += Number(p.amount ?? 0);
          }
          return { totalAmount: total, sampleCount: items.length };
        },
      },
    },
    {
      name: "Produits",
      endpoint: "/products",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => {
          const priceFields: Record<string, number> = {};
          for (const p of items) {
            for (const key of Object.keys(p)) {
              const kl = key.toLowerCase();
              if (kl.includes("price") || kl.includes("cost") || kl.includes("buying") || kl.includes("purchase") || kl.includes("achat")) {
                const val = Number(p[key] ?? 0);
                priceFields[key] = (priceFields[key] || 0) + (val > 0 ? 1 : 0);
              }
            }
          }
          return { total: items.length, champsPrix: priceFields };
        },
      },
    },
    {
      name: "Contrats",
      endpoint: "/contracts",
    },
    {
      name: "Opportunités (Pipeline)",
      endpoint: "/opportunities",
      opts: {
        extractFinancials: (items: Record<string, unknown>[]) => {
          let total = 0;
          const stages: Record<string, number> = {};
          for (const o of items) {
            total += Number(o.amount ?? 0);
            const s = String(o.step_name ?? o.step ?? "inconnu");
            stages[s] = (stages[s] || 0) + 1;
          }
          return { totalAmount: total, stages, sampleCount: items.length };
        },
      },
    },
    {
      name: "Projets",
      endpoint: "/projects",
    },
    {
      name: "Tâches",
      endpoint: "/tasks",
    },
    {
      name: "Cycles de travail",
      endpoint: "/workunits",
    },
  ];

  for (const probe of probes) {
    const result = await probeEndpoint(apiUrl, apiKey, probe.name, probe.endpoint, probe.opts);
    endpoints.push(result);
  }

  return NextResponse.json({
    apiUrl,
    endpoints,
    exploredAt: new Date().toISOString(),
  });
}
