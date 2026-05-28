"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Type, Square, Circle, Image, Minus,
  Trash2, Copy, ChevronUp, ChevronDown, Bold, Italic, Loader2,
  Variable, Palette, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

interface CoverElement {
  id: string;
  type: "text" | "rect" | "circle" | "line" | "image";
  x: number; // % from left
  y: number; // % from top
  width: number; // % of page width
  height: number; // % of page height
  rotation: number;
  // Text
  content?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  letterSpacing?: number;
  textTransform?: string;
  lineHeight?: number;
  // Shape
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  // Image
  src?: string;
  objectFit?: string;
}

interface CoverLayout {
  elements: CoverElement[];
  background: string; // color or gradient
  backgroundImage?: string;
  backgroundOpacity?: number;
}

const VARIABLES: { key: string; label: string }[] = [
  { key: "{{client_name}}", label: "Nom du client" },
  { key: "{{company_name}}", label: "Nom société" },
  { key: "{{date}}", label: "Date" },
  { key: "{{date_long}}", label: "Date longue" },
  { key: "{{nb_installations}}", label: "Nb installations" },
  { key: "{{nb_en_parc}}", label: "Nb en parc" },
  { key: "{{nb_hors_parc}}", label: "Nb hors parc" },
];

const A4_RATIO = 297 / 210; // height / width

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_LAYOUT: CoverLayout = {
  elements: [
    { id: "logo", type: "image", x: 35, y: 3, width: 30, height: 8, rotation: 0, src: "{{company_logo}}", objectFit: "contain", opacity: 1 },
    { id: "title", type: "text", x: 10, y: 35, width: 80, height: 8, rotation: 0, content: "Rapport de suivi", fontSize: 38, fontWeight: "800", color: "#1e293b", textAlign: "center", lineHeight: 1.1 },
    { id: "client", type: "text", x: 10, y: 45, width: 80, height: 7, rotation: 0, content: "{{client_name}}", fontSize: 32, fontWeight: "700", color: "#3b82f6", textAlign: "center", lineHeight: 1.1 },
    { id: "line", type: "rect", x: 35, y: 55, width: 30, height: 0.4, rotation: 0, backgroundColor: "#3b82f6", borderRadius: 2, opacity: 1 },
    { id: "date", type: "text", x: 10, y: 60, width: 80, height: 4, rotation: 0, content: "{{date_long}}", fontSize: 14, fontWeight: "400", color: "#94a3b8", textAlign: "center", textTransform: "uppercase", letterSpacing: 3 },
  ],
  background: "#ffffff",
};

export default function CoverEditorPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CoverLayout>(DEFAULT_LAYOUT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; elW: number; elH: number; corner: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [companyLogo, setCompanyLogo] = useState("");
  const [showVariables, setShowVariables] = useState(false);

  const selected = layout.elements.find((e) => e.id === selectedId) || null;

  // Load saved layout
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setPrimaryColor(data.report_primary_color || "#3b82f6");
        setCompanyLogo(data.company_logo || "");
        if (data.report_cover_layout) {
          try {
            const parsed = JSON.parse(data.report_cover_layout);
            if (parsed.elements) setLayout(parsed);
          } catch { /* use default */ }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Save layout
  async function saveLayout() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_cover_layout: JSON.stringify(layout),
        report_cover_template: "custom",
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Canvas dimensions
  function getCanvasRect() {
    if (!canvasRef.current) return { width: 600, height: 600 * A4_RATIO, left: 0, top: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return rect;
  }

  // --- Drag & Drop ---
  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = layout.elements.find((el) => el.id === id);
    if (!el) return;
    setSelectedId(id);
    setDragging({ id, startX: e.clientX, startY: e.clientY, elX: el.x, elY: el.y });
  }, [layout.elements]);

  const handleResizeDown = useCallback((e: React.MouseEvent, id: string, corner: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = layout.elements.find((el) => el.id === id);
    if (!el) return;
    setResizing({ id, startX: e.clientX, startY: e.clientY, elW: el.width, elH: el.height, corner });
  }, [layout.elements]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const rect = getCanvasRect();

      if (dragging) {
        const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
        const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
        setLayout((prev) => ({
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === dragging.id
              ? { ...el, x: Math.max(0, Math.min(100 - el.width, dragging.elX + dx)), y: Math.max(0, Math.min(100 - el.height, dragging.elY + dy)) }
              : el
          ),
        }));
      }

      if (resizing) {
        const dx = ((e.clientX - resizing.startX) / rect.width) * 100;
        const dy = ((e.clientY - resizing.startY) / rect.height) * 100;
        setLayout((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (el.id !== resizing.id) return el;
            const newW = Math.max(2, resizing.elW + dx);
            const newH = Math.max(0.3, resizing.elH + dy);
            return { ...el, width: newW, height: newH };
          }),
        }));
      }
    }

    function handleMouseUp() {
      setDragging(null);
      setResizing(null);
    }

    if (dragging || resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, resizing]);

  // --- Element Operations ---
  function addElement(type: CoverElement["type"]) {
    const base: CoverElement = {
      id: uid(), type, x: 20, y: 20, width: 30, height: 6, rotation: 0, opacity: 1,
    };
    if (type === "text") {
      Object.assign(base, { content: "Nouveau texte", fontSize: 20, fontWeight: "400", color: "#1e293b", textAlign: "center", lineHeight: 1.3 });
    } else if (type === "rect") {
      Object.assign(base, { backgroundColor: primaryColor, height: 0.5, borderRadius: 0 });
    } else if (type === "circle") {
      Object.assign(base, { backgroundColor: primaryColor, height: 6, borderRadius: 9999 });
    } else if (type === "line") {
      Object.assign(base, { backgroundColor: primaryColor, height: 0.3, width: 40 });
    } else if (type === "image") {
      Object.assign(base, { src: "", height: 10, objectFit: "contain" });
    }
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, base] }));
    setSelectedId(base.id);
  }

  function updateElement(id: string, updates: Partial<CoverElement>) {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
    }));
  }

  function deleteElement(id: string) {
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateElement(id: string) {
    const el = layout.elements.find((e) => e.id === id);
    if (!el) return;
    const copy = { ...el, id: uid(), x: el.x + 2, y: el.y + 2 };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, copy] }));
    setSelectedId(copy.id);
  }

  function moveLayer(id: string, direction: "up" | "down") {
    setLayout((prev) => {
      const idx = prev.elements.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx + 1 : idx - 1;
      if (newIdx < 0 || newIdx >= prev.elements.length) return prev;
      const arr = [...prev.elements];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, elements: arr };
    });
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    setSelectedId(null);
  }

  function insertVariable(varKey: string) {
    if (!selected || selected.type !== "text") return;
    updateElement(selected.id, { content: (selected.content || "") + varKey });
    setShowVariables(false);
  }

  // --- Render preview of variable content ---
  function previewContent(content: string) {
    return content
      .replace(/\{\{client_name\}\}/g, "Nom du client")
      .replace(/\{\{company_name\}\}/g, "Ma Société")
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("fr-FR"))
      .replace(/\{\{date_long\}\}/g, new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }))
      .replace(/\{\{nb_installations\}\}/g, "24")
      .replace(/\{\{nb_en_parc\}\}/g, "18")
      .replace(/\{\{nb_hors_parc\}\}/g, "6")
      .replace(/\{\{company_logo\}\}/g, companyLogo || "");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/settings")} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Éditeur de page de garde</h1>
            <p className="text-xs text-slate-400">Glissez, redimensionnez et personnalisez les éléments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={resetLayout} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
          </button>
          <button
            onClick={saveLayout}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors",
              saved ? "bg-emerald-500 text-white" : "bg-primary-600 text-white hover:bg-primary-700"
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Enregistré !" : saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <div className="w-14 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-3 gap-1 flex-shrink-0">
          <p className="text-[9px] font-medium text-slate-400 uppercase mb-1">Ajouter</p>
          {([
            { type: "text" as const, icon: Type, tip: "Texte" },
            { type: "rect" as const, icon: Square, tip: "Rectangle" },
            { type: "circle" as const, icon: Circle, tip: "Cercle" },
            { type: "line" as const, icon: Minus, tip: "Ligne" },
            { type: "image" as const, icon: Image, tip: "Image" },
          ]).map(({ type, icon: Icon, tip }) => (
            <button
              key={type}
              onClick={() => addElement(type)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title={tip}
            >
              <Icon className="h-4.5 w-4.5" />
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-8" onClick={() => setSelectedId(null)}>
          <div
            ref={canvasRef}
            className="relative bg-white shadow-2xl border border-slate-200"
            style={{ width: "min(55vw, 500px)", aspectRatio: `210 / 297` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background */}
            {layout.backgroundImage && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url('${layout.backgroundImage}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: layout.backgroundOpacity ?? 0.15,
                }}
              />
            )}
            <div className="absolute inset-0" style={{ backgroundColor: layout.background }} />

            {/* Elements */}
            {layout.elements.map((el) => (
              <div
                key={el.id}
                className={cn(
                  "absolute group",
                  selectedId === el.id && "ring-2 ring-primary-500 ring-offset-1",
                  dragging?.id === el.id && "cursor-grabbing"
                )}
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.width}%`,
                  height: `${el.height}%`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  zIndex: selectedId === el.id ? 50 : undefined,
                }}
                onMouseDown={(e) => handleMouseDown(e, el.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
              >
                {/* Element content */}
                {el.type === "text" && (
                  <div
                    className="w-full h-full flex items-center justify-center overflow-hidden select-none pointer-events-none"
                    style={{
                      fontSize: `${(el.fontSize || 16) * 0.6}px`,
                      fontWeight: el.fontWeight || "400",
                      fontStyle: el.fontStyle || "normal",
                      color: el.color || "#000",
                      textAlign: (el.textAlign as CanvasTextAlign) || "center",
                      letterSpacing: el.letterSpacing ? `${el.letterSpacing * 0.6}px` : undefined,
                      textTransform: (el.textTransform as React.CSSProperties["textTransform"]) || "none",
                      lineHeight: el.lineHeight || 1.3,
                      opacity: el.opacity ?? 1,
                    }}
                  >
                    {previewContent(el.content || "")}
                  </div>
                )}
                {(el.type === "rect" || el.type === "line") && (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: el.backgroundColor || primaryColor,
                      borderRadius: el.borderRadius ?? 0,
                      border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || "#000"}` : undefined,
                      opacity: el.opacity ?? 1,
                    }}
                  />
                )}
                {el.type === "circle" && (
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      backgroundColor: el.backgroundColor || primaryColor,
                      border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || "#000"}` : undefined,
                      opacity: el.opacity ?? 1,
                    }}
                  />
                )}
                {el.type === "image" && (
                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    {(el.src && previewContent(el.src)) ? (
                      <img
                        src={previewContent(el.src)}
                        alt=""
                        className="max-w-full max-h-full pointer-events-none"
                        style={{ objectFit: (el.objectFit as React.CSSProperties["objectFit"]) || "contain", opacity: el.opacity ?? 1 }}
                      />
                    ) : (
                      <div className="text-slate-300 text-xs flex flex-col items-center gap-1">
                        <Image className="h-5 w-5" />
                        <span>Image</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Resize handle */}
                {selectedId === el.id && (
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary-500 border-2 border-white rounded-sm cursor-se-resize z-50"
                    onMouseDown={(e) => handleResizeDown(e, el.id, "se")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel - Properties */}
        <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0">
          {selected ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  {selected.type === "text" ? "Texte" : selected.type === "rect" ? "Rectangle" : selected.type === "circle" ? "Cercle" : selected.type === "line" ? "Ligne" : "Image"}
                </h3>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => moveLayer(selected.id, "up")} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Monter"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveLayer(selected.id, "down")} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Descendre"><ChevronDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => duplicateElement(selected.id)} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Dupliquer"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteElement(selected.id)} className="p-1 text-red-400 hover:text-red-600 rounded" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              {/* Position & Size */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Position & Taille</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-400">
                    X (%)
                    <input type="number" value={Math.round(selected.x * 10) / 10} onChange={(e) => updateElement(selected.id, { x: parseFloat(e.target.value) || 0 })} className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" step="0.5" />
                  </label>
                  <label className="text-xs text-slate-400">
                    Y (%)
                    <input type="number" value={Math.round(selected.y * 10) / 10} onChange={(e) => updateElement(selected.id, { y: parseFloat(e.target.value) || 0 })} className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" step="0.5" />
                  </label>
                  <label className="text-xs text-slate-400">
                    Largeur (%)
                    <input type="number" value={Math.round(selected.width * 10) / 10} onChange={(e) => updateElement(selected.id, { width: parseFloat(e.target.value) || 1 })} className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" step="0.5" />
                  </label>
                  <label className="text-xs text-slate-400">
                    Hauteur (%)
                    <input type="number" value={Math.round(selected.height * 10) / 10} onChange={(e) => updateElement(selected.id, { height: parseFloat(e.target.value) || 0.3 })} className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" step="0.1" />
                  </label>
                </div>
              </div>

              {/* Opacity */}
              <div>
                <label className="text-xs text-slate-400">Opacité ({Math.round((selected.opacity ?? 1) * 100)}%)</label>
                <input type="range" min="0" max="1" step="0.05" value={selected.opacity ?? 1} onChange={(e) => updateElement(selected.id, { opacity: parseFloat(e.target.value) })} className="w-full accent-primary-600 mt-1" />
              </div>

              {/* Text-specific */}
              {selected.type === "text" && (
                <>
                  <div>
                    <label className="text-xs text-slate-400">Contenu</label>
                    <textarea
                      value={selected.content || ""}
                      onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                      rows={2}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                    />
                    <div className="relative mt-1">
                      <button
                        onClick={() => setShowVariables(!showVariables)}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                      >
                        <Variable className="h-3 w-3" /> Insérer une variable
                      </button>
                      {showVariables && (
                        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 w-52">
                          {VARIABLES.map((v) => (
                            <button
                              key={v.key}
                              onClick={() => insertVariable(v.key)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex justify-between"
                            >
                              <span className="text-slate-700">{v.label}</span>
                              <code className="text-[10px] text-slate-400">{v.key}</code>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-400">
                      Taille ({selected.fontSize}px)
                      <input type="range" min="8" max="80" value={selected.fontSize || 16} onChange={(e) => updateElement(selected.id, { fontSize: parseInt(e.target.value) })} className="w-full accent-primary-600 mt-0.5" />
                    </label>
                    <label className="text-xs text-slate-400">
                      Interligne ({selected.lineHeight ?? 1.3})
                      <input type="range" min="0.8" max="2.5" step="0.1" value={selected.lineHeight ?? 1.3} onChange={(e) => updateElement(selected.id, { lineHeight: parseFloat(e.target.value) })} className="w-full accent-primary-600 mt-0.5" />
                    </label>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateElement(selected.id, { fontWeight: selected.fontWeight === "700" ? "400" : "700" })}
                      className={cn("p-1.5 rounded", selected.fontWeight === "700" || selected.fontWeight === "800" ? "bg-primary-100 text-primary-700" : "text-slate-400 hover:text-slate-600")}
                    ><Bold className="h-3.5 w-3.5" /></button>
                    <button
                      onClick={() => updateElement(selected.id, { fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}
                      className={cn("p-1.5 rounded", selected.fontStyle === "italic" ? "bg-primary-100 text-primary-700" : "text-slate-400 hover:text-slate-600")}
                    ><Italic className="h-3.5 w-3.5" /></button>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateElement(selected.id, { textAlign: align })}
                        className={cn("p-1.5 rounded text-xs", selected.textAlign === align ? "bg-primary-100 text-primary-700" : "text-slate-400 hover:text-slate-600")}
                      >
                        {align === "left" ? "G" : align === "center" ? "C" : "D"}
                      </button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    {(["none", "uppercase"] as const).map((tt) => (
                      <button
                        key={tt}
                        onClick={() => updateElement(selected.id, { textTransform: tt })}
                        className={cn("p-1.5 rounded text-[10px] font-bold", selected.textTransform === tt ? "bg-primary-100 text-primary-700" : "text-slate-400 hover:text-slate-600")}
                      >
                        {tt === "none" ? "Aa" : "AA"}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-400">
                      Couleur
                      <input type="color" value={selected.color || "#000000"} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="w-full h-7 mt-0.5 rounded border border-slate-200 cursor-pointer" />
                    </label>
                    <label className="text-xs text-slate-400">
                      Espacement ({selected.letterSpacing ?? 0}px)
                      <input type="range" min="0" max="10" step="0.5" value={selected.letterSpacing ?? 0} onChange={(e) => updateElement(selected.id, { letterSpacing: parseFloat(e.target.value) })} className="w-full accent-primary-600 mt-2" />
                    </label>
                  </div>
                </>
              )}

              {/* Shape-specific */}
              {(selected.type === "rect" || selected.type === "circle" || selected.type === "line") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-400">
                      Couleur fond
                      <input type="color" value={selected.backgroundColor || primaryColor} onChange={(e) => updateElement(selected.id, { backgroundColor: e.target.value })} className="w-full h-7 mt-0.5 rounded border border-slate-200 cursor-pointer" />
                    </label>
                    {selected.type === "rect" && (
                      <label className="text-xs text-slate-400">
                        Arrondi ({selected.borderRadius ?? 0}px)
                        <input type="range" min="0" max="50" value={selected.borderRadius ?? 0} onChange={(e) => updateElement(selected.id, { borderRadius: parseInt(e.target.value) })} className="w-full accent-primary-600 mt-2" />
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-400">
                      Bordure ({selected.borderWidth ?? 0}px)
                      <input type="range" min="0" max="10" value={selected.borderWidth ?? 0} onChange={(e) => updateElement(selected.id, { borderWidth: parseInt(e.target.value) })} className="w-full accent-primary-600 mt-0.5" />
                    </label>
                    {(selected.borderWidth ?? 0) > 0 && (
                      <label className="text-xs text-slate-400">
                        Couleur bordure
                        <input type="color" value={selected.borderColor || "#000000"} onChange={(e) => updateElement(selected.id, { borderColor: e.target.value })} className="w-full h-7 mt-0.5 rounded border border-slate-200 cursor-pointer" />
                      </label>
                    )}
                  </div>
                </>
              )}

              {/* Image-specific */}
              {selected.type === "image" && (
                <>
                  <div>
                    <label className="text-xs text-slate-400">URL de l&apos;image</label>
                    <input
                      type="text"
                      value={selected.src || ""}
                      onChange={(e) => updateElement(selected.id, { src: e.target.value })}
                      placeholder="URL ou {{company_logo}}"
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Utilisez <code>{`{{company_logo}}`}</code> pour le logo société</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Ajustement</label>
                    <select
                      value={selected.objectFit || "contain"}
                      onChange={(e) => updateElement(selected.id, { objectFit: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="contain">Contenir</option>
                      <option value="cover">Couvrir</option>
                      <option value="fill">Remplir</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 text-center">
              <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6">
                <Palette className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">Sélectionnez un élément</p>
                <p className="text-xs text-slate-400 mt-1">Cliquez sur un élément du canvas pour le modifier, ou ajoutez-en un depuis la barre d&apos;outils</p>
              </div>

              {/* Background settings */}
              <div className="mt-6 text-left space-y-3">
                <p className="text-xs font-medium text-slate-500">Fond de page</p>
                <label className="text-xs text-slate-400">
                  Couleur
                  <input type="color" value={layout.background} onChange={(e) => setLayout((prev) => ({ ...prev, background: e.target.value }))} className="w-full h-7 mt-0.5 rounded border border-slate-200 cursor-pointer" />
                </label>
                <label className="text-xs text-slate-400">
                  Image de fond (URL)
                  <input
                    type="text"
                    value={layout.backgroundImage || ""}
                    onChange={(e) => setLayout((prev) => ({ ...prev, backgroundImage: e.target.value }))}
                    placeholder="URL..."
                    className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </label>
                {layout.backgroundImage && (
                  <label className="text-xs text-slate-400">
                    Opacité ({Math.round((layout.backgroundOpacity ?? 0.15) * 100)}%)
                    <input type="range" min="0" max="1" step="0.05" value={layout.backgroundOpacity ?? 0.15} onChange={(e) => setLayout((prev) => ({ ...prev, backgroundOpacity: parseFloat(e.target.value) }))} className="w-full accent-primary-600 mt-0.5" />
                  </label>
                )}
              </div>

              {/* Elements list */}
              <div className="mt-6 text-left">
                <p className="text-xs font-medium text-slate-500 mb-2">Éléments ({layout.elements.length})</p>
                <div className="space-y-1">
                  {layout.elements.map((el) => (
                    <button
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-50 flex items-center gap-2 text-slate-600"
                    >
                      {el.type === "text" ? <Type className="h-3 w-3" /> : el.type === "image" ? <Image className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                      <span className="truncate">{el.type === "text" ? (el.content || "Texte").slice(0, 25) : el.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
