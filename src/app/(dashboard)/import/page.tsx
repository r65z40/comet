"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, ArrowLeft, Eye, Download, Table2,
  Monitor, Users, Package, FileText as FileTextAlt,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ColumnMapping {
  csvColumn: string;
  appField: string;
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  created?: number;
  updated?: number;
  total?: number;
  errors?: string[];
}

// Expected fields for the app
const APP_FIELDS = [
  { key: "", label: "— Ignorer —" },
  { key: "client", label: "Client *", required: true, description: "Nom du client" },
  { key: "nom_produit", label: "Produit", description: "Nom du produit / service" },
  { key: "num_facture", label: "N° Facture", description: "Numéro de facture" },
  { key: "date_facturation", label: "Date facturation", description: "DD/MM/YYYY ou YYYY-MM-DD" },
  { key: "description", label: "Description", description: "Description de la ligne" },
  { key: "quantite", label: "Quantité", description: "Quantité (défaut: 1)" },
  { key: "prix_achat", label: "Prix d'achat", description: "Coût unitaire HT" },
  { key: "prix_vente", label: "Prix de vente", description: "Prix de vente unitaire HT" },
  { key: "famille_parc", label: "Famille / Parc", description: "Catégorie du produit" },
  { key: "fournisseur", label: "Fournisseur", description: "Fournisseur du produit" },
  { key: "echeance_garantie", label: "Échéance garantie", description: "Date de fin de garantie" },
  { key: "renouveler", label: "Renouveler", description: "Oui/Non, Vrai/Faux, 1/0" },
  { key: "toujours_en_parc", label: "Toujours en parc", description: "Oui/Non, Vrai/Faux, 1/0" },
  { key: "com_parc", label: "Com Parc", description: "Commentaire parc (info propriétaire)" },
];

// Auto-detection aliases for smart column mapping
const COLUMN_ALIASES: Record<string, string[]> = {
  client: ["client", "nom_client", "customer", "société", "societe", "raison_sociale"],
  nom_produit: ["nom_produit", "produit", "product", "nom_product", "article", "designation", "désignation"],
  num_facture: ["num_facture", "numero_facture", "n°_facture", "facture", "invoice", "n°facture", "no_facture"],
  date_facturation: ["date_facturation", "date_facture", "date", "invoice_date"],
  description: ["description", "desc", "libellé", "libelle", "detail", "détail"],
  quantite: ["quantité", "quantite", "qte", "qty", "quantity"],
  prix_achat: ["prix_achat", "prix_d'achat", "cout", "coût", "cost", "pa", "prix_achat_ht"],
  prix_vente: ["prix_vente", "prix_de_vente", "prix", "price", "pv", "prix_vente_ht", "montant"],
  famille_parc: ["famille_parc", "famille", "family", "categorie", "catégorie", "parc"],
  fournisseur: ["fournisseur", "supplier", "vendor", "marque"],
  echeance_garantie: ["echeance_garantie", "échéance_garantie", "echeance", "garantie", "warranty", "fin_garantie", "date_garantie"],
  renouveler: ["renouveler", "renew", "renouvellement", "renewal"],
  toujours_en_parc: ["toujours_en_parc", "en_parc", "in_park", "actif", "active"],
  com_parc: ["com_parc", "com parc", "commentaire_parc", "commentaire parc", "com_park"],
};

function parseCSVPreview(text: string, separator: string): PreviewData {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.replace(/^\uFEFF/, "").trim()
  );
  const rows = lines.slice(1, 6).map((line) => parseCSVLine(line));
  const totalRows = lines.length - 1;

  return { headers, rows, totalRows };
}

function autoMapColumns(headers: string[]): ColumnMapping[] {
  return headers.map((header) => {
    const normalized = header.toLowerCase().replace(/\s+/g, "_").replace(/['']/g, "'");
    let matched = "";
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        matched = field;
        break;
      }
    }
    return { csvColumn: header, appField: matched };
  });
}

function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  for (const char of firstLine) {
    if (char in counts) counts[char]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ";";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [separator, setSeparator] = useState(";");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);

    const isXlsx = f.name.toLowerCase().endsWith(".xlsx") || f.name.toLowerCase().endsWith(".xls");

    if (isXlsx) {
      // Dynamic import of xlsx library
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Convert to CSV with semicolon separator
      const csvText = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
      setFileText(csvText);
      setSeparator(";");
      const p = parseCSVPreview(csvText, ";");
      setPreview(p);
      const autoMappings = autoMapColumns(p.headers);
      setMappings(autoMappings);
      setStep(2);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);

        let text: string;
        // Check for UTF-8 BOM (EF BB BF)
        const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
        if (hasUtf8Bom) {
          text = new TextDecoder("utf-8").decode(bytes);
        } else {
          // Try strict UTF-8 first
          try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            // Fallback to Latin-1 (Windows-1252) for French Excel exports
            text = new TextDecoder("iso-8859-1").decode(bytes);
          }
        }

        setFileText(text);
        const detected = detectSeparator(text);
        setSeparator(detected);
        const p = parseCSVPreview(text, detected);
        setPreview(p);
        const autoMappings = autoMapColumns(p.headers);
        setMappings(autoMappings);
        setStep(2);
      };
      reader.readAsArrayBuffer(f);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  }, [readFile]);

  const updateSeparator = useCallback((sep: string) => {
    setSeparator(sep);
    if (fileText) {
      const p = parseCSVPreview(fileText, sep);
      setPreview(p);
      setMappings(autoMapColumns(p.headers));
    }
  }, [fileText]);

  const updateMapping = useCallback((index: number, appField: string) => {
    setMappings((prev) => {
      const next = [...prev];
      // Clear any other column that was mapped to the same field
      if (appField) {
        next.forEach((m, i) => {
          if (i !== index && m.appField === appField) m.appField = "";
        });
      }
      next[index] = { ...next[index], appField };
      return next;
    });
  }, []);

  const hasRequiredMappings = mappings.some((m) => m.appField === "client");

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);
    setUploadProgress(0);

    try {
      // Build a column-name mapping: rename CSV headers to match API expectations
      const headerMap: Record<string, string> = {};
      mappings.forEach((m) => {
        if (m.appField) headerMap[m.csvColumn] = m.appField;
      });

      // Re-write the CSV with mapped headers
      const lines = fileText.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length > 0) {
        const originalHeaders = parseCSVPreview(fileText, separator).headers;
        const newHeaders = originalHeaders.map((h) => headerMap[h] || h);
        lines[0] = newHeaders.join(separator);
      }
      const newCsvContent = lines.join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + newCsvContent], { type: "text/csv;charset=utf-8" });
      const mappedFile = new File([blob], file.name, { type: "text/csv;charset=utf-8" });

      const formData = new FormData();
      formData.append("file", mappedFile);
      formData.append("separator", separator);

      // Use XMLHttpRequest for upload progress tracking
      const data = await new Promise<ImportResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/import");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 50)); // 0-50% = upload
          }
        };

        xhr.onload = () => {
          setUploadProgress(100);
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ success: true, message: json.message, created: json.created, updated: json.updated, total: json.total, errors: json.errors });
            } else {
              resolve({ success: false, message: json.error || "Erreur inconnue" });
            }
          } catch {
            resolve({ success: false, message: "Réponse invalide du serveur" });
          }
        };

        xhr.onerror = () => reject(new Error("Erreur réseau"));

        // After upload completes, show "processing" phase (50-99%)
        xhr.upload.onload = () => {
          setUploadProgress(50);
          const interval = setInterval(() => {
            setUploadProgress((prev) => {
              if (prev === null || prev >= 95) { clearInterval(interval); return prev; }
              return prev + 1;
            });
          }, 200);
          xhr.onload = () => {
            clearInterval(interval);
            setUploadProgress(100);
            try {
              const json = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ success: true, message: json.message, created: json.created, updated: json.updated, total: json.total, errors: json.errors });
              } else {
                resolve({ success: false, message: json.error || "Erreur inconnue" });
              }
            } catch {
              resolve({ success: false, message: "Réponse invalide du serveur" });
            }
          };
        };

        xhr.send(formData);
      });

      setResult(data);
      if (data.success) setStep(3);
    } catch {
      setResult({ success: false, message: "Erreur de connexion au serveur" });
    } finally {
      setImporting(false);
      setUploadProgress(null);
    }
  };

  const resetAll = () => {
    setStep(1);
    setFile(null);
    setFileText("");
    setPreview(null);
    setMappings([]);
    setResult(null);
    setUploadProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const headers = ["Client", "Nom Produit", "Num_Facture", "Date_Facturation", "Description", "Quantité", "Prix_Achat", "Prix_Vente", "Famille_Parc", "Fournisseur", "Echeance_Garantie", "Renouveler", "Toujours_en_parc"];
    const example = ["Entreprise Exemple", "Firewall FortiGate 60F", "FA-2024-001", "15/03/2024", "Installation firewall", "1", "450.00", "890.00", "Sécurité", "Fortinet", "15/03/2027", "Non", "Oui"];
    const BOM = "\uFEFF";
    const csv = headers.join(";") + "\n" + example.join(";") + "\n";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele_import_comet.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import / Export</h1>
        <p className="text-sm text-slate-500 mt-1">Importez ou exportez vos données au format CSV ou Excel</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Fichier" },
          { n: 2, label: "Mapping & Aperçu" },
          { n: 3, label: "Résultat" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            {n > 1 && <div className={`h-px w-8 ${step >= n ? "bg-primary-400" : "bg-slate-200"}`} />}
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              step === n
                ? "bg-primary-600 text-white"
                : step > n
                ? "bg-primary-100 text-primary-700"
                : "bg-slate-100 text-slate-400"
            }`}>
              <span>{n}</span>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: File Upload */}
      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? "border-primary-400 bg-primary-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            <Upload className={`h-12 w-12 mx-auto mb-4 ${dragOver ? "text-primary-500" : "text-slate-400"}`} />
            <p className="text-sm font-medium text-slate-700 mb-1">
              Glissez-déposez votre fichier CSV ou Excel ici
            </p>
            <p className="text-xs text-slate-400 mb-4">ou</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              Parcourir les fichiers
            </button>
            <p className="text-xs text-slate-400 mt-3">Formats : .csv, .txt, .tsv, .xlsx, .xls — Max 10 Mo</p>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Besoin d&apos;un modèle ?</p>
              <p className="text-xs text-slate-400">Téléchargez un fichier CSV d&apos;exemple avec les colonnes attendues</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger le modèle
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Column Mapping */}
      {step === 2 && preview && (
        <div className="space-y-5">
          {/* File info bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">{file?.name}</p>
                <p className="text-xs text-slate-400">
                  {preview.totalRows} ligne{preview.totalRows > 1 ? "s" : ""} • {preview.headers.length} colonne{preview.headers.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Séparateur</label>
                <select
                  value={separator}
                  onChange={(e) => updateSeparator(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-primary-500 focus:outline-none"
                >
                  <option value=";">Point-virgule ( ; )</option>
                  <option value=",">Virgule ( , )</option>
                  <option value={"\t"}>Tabulation</option>
                  <option value="|">Pipe ( | )</option>
                </select>
              </div>
              <button
                onClick={resetAll}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Changer de fichier"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Table2 className="h-4 w-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-slate-900">Mapping des colonnes</h3>
              <span className="text-xs text-slate-400 ml-2">Associez chaque colonne de votre CSV à un champ de l&apos;application</span>
            </div>

            {!hasRequiredMappings && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">La colonne <strong>Client</strong> est obligatoire. Veuillez l&apos;associer à une colonne de votre CSV.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mappings.map((mapping, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    mapping.appField ? "border-primary-200 bg-primary-50/50" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{mapping.csvColumn}</p>
                    {preview.rows[0] && preview.rows[0][idx] && (
                      <p className="text-xs text-slate-400 truncate">ex: {preview.rows[0][idx]}</p>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                  <select
                    value={mapping.appField}
                    onChange={(e) => updateMapping(idx, e.target.value)}
                    className={`rounded-lg border px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none flex-1 min-w-0 ${
                      mapping.appField ? "border-primary-300 bg-white text-primary-700 font-medium" : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {APP_FIELDS.map((f) => (
                      <option key={f.key} value={f.key} disabled={f.key !== "" && f.key !== mapping.appField && mappings.some((m) => m.appField === f.key)}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-slate-900">Aperçu des données</h3>
              <span className="text-xs text-slate-400 ml-2">5 premières lignes</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {preview.headers.map((h, i) => {
                      const mapping = mappings[i];
                      const field = APP_FIELDS.find((f) => f.key === mapping?.appField);
                      return (
                        <th key={i} className="px-3 py-2 text-left font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          <div>{h}</div>
                          {field && field.key && (
                            <div className="text-primary-500 font-normal mt-0.5">→ {field.label}</div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 hover:bg-slate-50">
                      {preview.headers.map((_, ci) => (
                        <td key={ci} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {row[ci] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload progress bar */}
          {importing && uploadProgress !== null && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {uploadProgress < 50
                    ? "Envoi du fichier..."
                    : uploadProgress < 100
                    ? "Traitement en cours..."
                    : "Terminé !"}
                </p>
                <span className="text-xs font-semibold text-primary-600">{uploadProgress}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    uploadProgress >= 100 ? "bg-emerald-500" : "bg-primary-500"
                  }`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Envoi</span>
                <span>Traitement serveur</span>
                <span>Terminé</span>
              </div>
            </div>
          )}

          {/* Error from import attempt */}
          {result && !result.success && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{result.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={resetAll}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </button>
            <button
              onClick={() => handleImport()}
              disabled={!hasRequiredMappings || importing}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importer {preview.totalRows} ligne{preview.totalRows > 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 space-y-6">
          <div className="text-center">
            {result.success ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">Import terminé !</h2>
                <p className="text-sm text-slate-500">{result.message}</p>
                {result.created !== undefined && result.total !== undefined && (
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                      <p className="text-xs text-slate-400">Importées</p>
                    </div>
                    {(result.updated ?? 0) > 0 && (
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                        <p className="text-xs text-slate-400">Mises à jour</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-400">{result.total - result.created}</p>
                      <p className="text-xs text-slate-400">Erreurs</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">Erreur d&apos;import</h2>
                <p className="text-sm text-red-600">{result.message}</p>
              </>
            )}
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-amber-700 mb-2">Détail des erreurs :</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-amber-600 py-0.5">{err}</p>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={resetAll}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Nouvel import
            </button>
          </div>
        </div>
      )}

      {/* ─── Export Section ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 pt-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Exporter des données</h2>
          <p className="text-sm text-slate-500 mt-1">Téléchargez vos données au format CSV (compatible Excel)</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { type: "installations", label: "Installations", desc: "Toutes les installations avec garanties, clients et produits", icon: Monitor, color: "primary" },
            { type: "clients", label: "Clients", desc: "Liste complète des clients avec coordonnées", icon: Users, color: "emerald" },
            { type: "products", label: "Produits", desc: "Catalogue produits avec familles et fournisseurs", icon: Package, color: "violet" },
            { type: "invoices", label: "Factures", desc: "Factures et lignes de facturation détaillées", icon: FileTextAlt, color: "amber" },
          ].map(({ type, label, desc, icon: Icon, color }) => (
            <div
              key={type}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 hover:border-slate-300 transition-colors"
            >
              <div className={`rounded-lg bg-${color}-50 p-2.5 w-fit`}>
                <Icon className={`h-5 w-5 text-${color}-600`} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                <p className="text-xs text-slate-400 mt-1">{desc}</p>
              </div>
              <a
                href={`/api/export?type=${type}`}
                download
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter CSV
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
