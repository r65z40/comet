"use client";

import { useState, useEffect, useRef } from "react";
import { SettingsTabProps } from "./GeneralTab";
import { cn } from "@/lib/utils";
import {
  Save,
  Loader2,
  FileText,
  Upload,
  ImageIcon,
  Palette,
  ChevronDown,
  X,
  Check,
} from "lucide-react";

export default function ReportsTab({ settings, isAdmin, openSections, toggleSection }: SettingsTabProps) {
  // Report settings
  const [reportTitle, setReportTitle] = useState("");
  const [reportSubtitle, setReportSubtitle] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [reportGroupMode, setReportGroupMode] = useState("date");
  const [reportPrimaryColor, setReportPrimaryColor] = useState("#3b82f6");
  const [reportShowStats, setReportShowStats] = useState(true);
  const [reportShowFamily, setReportShowFamily] = useState(true);
  const [reportShowSupplier, setReportShowSupplier] = useState(true);
  const [reportShowDuration, setReportShowDuration] = useState(true);
  const [reportShowVerticalName, setReportShowVerticalName] = useState(true);
  const [reportIncludeHorsParc, setReportIncludeHorsParc] = useState(true);
  const [reportShowRenewedCount, setReportShowRenewedCount] = useState(false);
  const [reportIncludeRenewed, setReportIncludeRenewed] = useState(false);
  const [reportShowQuantity, setReportShowQuantity] = useState(false);
  const [reportShowComParc, setReportShowComParc] = useState(false);
  const [reportShowHeaderRow, setReportShowHeaderRow] = useState(true);
  const [reportShowStatus, setReportShowStatus] = useState(true);

  const [reportFooterText, setReportFooterText] = useState("");
  const [reportOrientation, setReportOrientation] = useState("portrait");
  const [reportCoverBg, setReportCoverBg] = useState("");
  const [reportCoverBgOpacity, setReportCoverBgOpacity] = useState("15");
  const reportCoverBgRef = useRef<HTMLInputElement>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReport, setSavedReport] = useState(false);
  const companyLogoRef = useRef<HTMLInputElement>(null);

  // Cover logo position/size settings
  const [companyLogoPosition, setCompanyLogoPosition] = useState("top-center");
  const [companyLogoSize, setCompanyLogoSize] = useState("180");
  const [companyLogoTop, setCompanyLogoTop] = useState("5");
  const [clientLogoPosition, setClientLogoPosition] = useState("center");
  const [clientLogoSize, setClientLogoSize] = useState("150");
  const [clientLogoTop, setClientLogoTop] = useState("70");
  const [reportShowDate, setReportShowDate] = useState(true);

  // Cover template settings
  const [coverTemplate, setCoverTemplate] = useState("classic");
  const [corporateTitle, setCorporateTitle] = useState("Rapport client");
  const [corporateTagline, setCorporateTagline] = useState("");
  const [corpLogoHeight, setCorpLogoHeight] = useState("90");
  const [corpLogoGap, setCorpLogoGap] = useState("28");
  const [corpDividerHeight, setCorpDividerHeight] = useState("70");
  const [corpDividerWidth, setCorpDividerWidth] = useState("1.5");
  const [corpDividerColor, setCorpDividerColor] = useState("");
  const [corpTitleSize, setCorpTitleSize] = useState("36");
  const [corpTitleColor, setCorpTitleColor] = useState("#1e293b");
  const [corpNameSize, setCorpNameSize] = useState("26");
  const [corpHrWidth, setCorpHrWidth] = useState("200");
  const [corpHrHeight, setCorpHrHeight] = useState("2");
  const [corpTaglineSize, setCorpTaglineSize] = useState("15");
  const [corpDateSize, setCorpDateSize] = useState("14");
  // Executive template settings
  const [execBandAngle, setExecBandAngle] = useState("12");
  const [execBandWidth, setExecBandWidth] = useState("45");
  const [execBandColor, setExecBandColor] = useState("");
  const [execTitleSize, setExecTitleSize] = useState("44");
  const [execSubtitleSize, setExecSubtitleSize] = useState("18");
  const [execTitle, setExecTitle] = useState("Rapport client");
  const [execSubtitle, setExecSubtitle] = useState("");
  const [execAccentWidth, setExecAccentWidth] = useState("60");
  const [execAccentHeight, setExecAccentHeight] = useState("4");

  useEffect(() => {
    const data = settings;
    setReportTitle(data.report_title || "");
    setReportSubtitle(data.report_subtitle || "");
    setReportMessage(data.report_message || "");
    setCompanyLogo(data.company_logo || "");
    setCompanyName(data.company_name || "");
    setReportGroupMode(data.report_group_mode || "date");
    setReportPrimaryColor(data.report_primary_color || "#3b82f6");
    setReportShowStats(data.report_show_stats !== "false");
    setReportShowFamily(data.report_show_family !== "false");
    setReportShowSupplier(data.report_show_supplier !== "false");
    setReportShowDuration(data.report_show_duration !== "false");
    setReportShowVerticalName(data.report_show_vertical_name !== "false");
    setReportIncludeHorsParc(data.report_include_hors_parc !== "false");
    setReportShowRenewedCount(data.report_show_renewed_count === "true");
    setReportShowQuantity(data.report_show_quantity === "true");
    setReportShowComParc(data.report_show_com_parc === "true");
    setReportShowHeaderRow(data.report_show_header_row !== "false");
    setReportShowStatus(data.report_show_status !== "false");
    setReportIncludeRenewed(data.report_include_renewed === "true");

    setReportFooterText(data.report_footer_text || "");
    setReportOrientation(data.report_orientation || "portrait");
    setReportCoverBg(data.report_cover_bg || "");
    setReportCoverBgOpacity(data.report_cover_bg_opacity || "15");
    setCompanyLogoPosition(data.report_company_logo_position || "top-center");
    setCompanyLogoSize(data.report_company_logo_size || "180");
    setCompanyLogoTop(data.report_company_logo_top || "5");
    setClientLogoPosition(data.report_client_logo_position || "center");
    setClientLogoSize(data.report_client_logo_size || "150");
    setClientLogoTop(data.report_client_logo_top || "70");
    setReportShowDate(data.report_show_date !== "false");
    setCoverTemplate(data.report_cover_template || "classic");
    setCorporateTitle(data.report_corporate_title || "Rapport client");
    setCorporateTagline(data.report_corporate_tagline || "");
    setCorpLogoHeight(data.report_corp_logo_height || "90");
    setCorpLogoGap(data.report_corp_logo_gap || "28");
    setCorpDividerHeight(data.report_corp_divider_height || "70");
    setCorpDividerWidth(data.report_corp_divider_width || "1.5");
    setCorpDividerColor(data.report_corp_divider_color || "");
    setCorpTitleSize(data.report_corp_title_size || "36");
    setCorpTitleColor(data.report_corp_title_color || "#1e293b");
    setCorpNameSize(data.report_corp_name_size || "26");
    setCorpHrWidth(data.report_corp_hr_width || "200");
    setCorpHrHeight(data.report_corp_hr_height || "2");
    setCorpTaglineSize(data.report_corp_tagline_size || "15");
    setCorpDateSize(data.report_corp_date_size || "14");
    setExecBandAngle(data.report_exec_band_angle || "12");
    setExecBandWidth(data.report_exec_band_width || "45");
    setExecBandColor(data.report_exec_band_color || "");
    setExecTitleSize(data.report_exec_title_size || "44");
    setExecSubtitleSize(data.report_exec_subtitle_size || "18");
    setExecTitle(data.report_exec_title || "Rapport client");
    setExecSubtitle(data.report_exec_subtitle || "");
    setExecAccentWidth(data.report_exec_accent_width || "60");
    setExecAccentHeight(data.report_exec_accent_height || "4");
  }, [settings]);

  async function handleSaveReport() {
    setSavingReport(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_title: reportTitle,
        report_subtitle: reportSubtitle,
        report_message: reportMessage,
        company_logo: companyLogo,
        company_name: companyName,
        report_group_mode: reportGroupMode,
        report_primary_color: reportPrimaryColor,
        report_show_stats: reportShowStats ? "true" : "false",
        report_show_family: reportShowFamily ? "true" : "false",
        report_show_supplier: reportShowSupplier ? "true" : "false",
        report_show_duration: reportShowDuration ? "true" : "false",
        report_show_vertical_name: reportShowVerticalName ? "true" : "false",
        report_include_hors_parc: reportIncludeHorsParc ? "true" : "false",
        report_show_renewed_count: reportShowRenewedCount ? "true" : "false",
        report_show_quantity: reportShowQuantity ? "true" : "false",
        report_show_com_parc: reportShowComParc ? "true" : "false",
        report_show_header_row: reportShowHeaderRow ? "true" : "false",
        report_show_status: reportShowStatus ? "true" : "false",
        report_include_renewed: reportIncludeRenewed ? "true" : "false",

        report_footer_text: reportFooterText,
        report_orientation: reportOrientation,
        report_cover_bg: reportCoverBg,
        report_cover_bg_opacity: reportCoverBgOpacity,
        report_company_logo_position: companyLogoPosition,
        report_company_logo_size: companyLogoSize,
        report_company_logo_top: companyLogoTop,
        report_client_logo_position: clientLogoPosition,
        report_client_logo_size: clientLogoSize,
        report_client_logo_top: clientLogoTop,
        report_show_date: reportShowDate ? "true" : "false",
        report_cover_template: coverTemplate,
        report_corporate_title: corporateTitle,
        report_corporate_tagline: corporateTagline,
        report_corp_logo_height: corpLogoHeight,
        report_corp_logo_gap: corpLogoGap,
        report_corp_divider_height: corpDividerHeight,
        report_corp_divider_width: corpDividerWidth,
        report_corp_divider_color: corpDividerColor,
        report_corp_title_size: corpTitleSize,
        report_corp_title_color: corpTitleColor,
        report_corp_name_size: corpNameSize,
        report_corp_hr_width: corpHrWidth,
        report_corp_hr_height: corpHrHeight,
        report_corp_tagline_size: corpTaglineSize,
        report_corp_date_size: corpDateSize,
        report_exec_band_angle: execBandAngle,
        report_exec_band_width: execBandWidth,
        report_exec_band_color: execBandColor,
        report_exec_title_size: execTitleSize,
        report_exec_subtitle_size: execSubtitleSize,
        report_exec_title: execTitle,
        report_exec_subtitle: execSubtitle,
        report_exec_accent_width: execAccentWidth,
        report_exec_accent_height: execAccentHeight,
      }),
    });
    setSavingReport(false);
    setSavedReport(true);
    setTimeout(() => setSavedReport(false), 3000);
  }

  return (<>
      {/* Personnalisation du rapport */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => toggleSection("report")} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <FileText className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">Personnalisation du rapport client</h3>
              <p className="text-xs text-slate-400">Personnalisez la première page du rapport imprimable depuis la fiche client.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSections.report ? "rotate-180" : ""}`} />
        </button>
        {openSections.report && <div className="px-6 pb-6 space-y-5 border-t border-slate-100 pt-5">

        {/* Template selector */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-3">
            Modèle de page de garde
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Classic card */}
            <button
              onClick={() => setCoverTemplate("classic")}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "classic"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "classic" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1.5 px-3">
                  <div className="w-10 h-5 rounded bg-slate-200" />
                  <div className="w-24 h-2.5 rounded bg-slate-300" />
                  <div className="w-28 h-3 rounded bg-primary-300 mt-1" />
                  <div className="w-16 h-2 rounded bg-slate-200 mt-0.5" />
                  <div className="w-12 h-2 rounded bg-slate-100 mt-1" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Classique</p>
                  <p className="text-xs text-slate-400 mt-0.5">Logo centré, titre et nom du client.</p>
                </div>
              </div>
            </button>
            {/* Corporate card */}
            <button
              onClick={() => setCoverTemplate("corporate")}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "corporate"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "corporate" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-1.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 rounded bg-slate-200" />
                    <div className="w-px h-6 bg-primary-400" />
                    <div className="w-8 h-5 rounded bg-slate-200" />
                  </div>
                  <div className="w-20 h-2.5 rounded bg-slate-800 mt-1" />
                  <div className="w-24 h-px bg-primary-400 mt-0.5" />
                  <div className="w-16 h-2 rounded bg-slate-200 mt-0.5" />
                  <div className="w-14 h-2 rounded bg-slate-100 mt-1" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Corporate</p>
                  <p className="text-xs text-slate-400 mt-0.5">Logos côte à côte, trait de séparation.</p>
                </div>
              </div>
            </button>
            {/* Executive card */}
            <button
              onClick={() => setCoverTemplate("executive")}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "executive"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "executive" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-white relative overflow-hidden">
                  {/* Diagonal band */}
                  <div className="absolute -left-4 bottom-0 w-[60%] h-full bg-primary-500 origin-bottom-left" style={{ transform: "skewX(-12deg)" }} />
                  <div className="absolute left-3 bottom-3 flex flex-col gap-1 z-10">
                    <div className="w-6 h-3 rounded-sm bg-white/80" />
                    <div className="w-16 h-2 rounded bg-white/90" />
                    <div className="w-12 h-1.5 rounded bg-white/60" />
                  </div>
                  <div className="absolute right-3 top-3 z-10">
                    <div className="w-7 h-4 rounded-sm bg-slate-200" />
                  </div>
                  <div className="absolute right-3 bottom-4 z-10">
                    <div className="w-10 h-1.5 rounded bg-slate-300" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Executive</p>
                  <p className="text-xs text-slate-400 mt-0.5">Bande colorée diagonale, design premium.</p>
                </div>
              </div>
            </button>
            {/* Custom editor card */}
            <button
              onClick={() => { setCoverTemplate("custom"); window.open("/settings/cover-editor", "_blank"); }}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                coverTemplate === "custom"
                  ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {coverTemplate === "custom" && (
                <div className="absolute top-2.5 right-2.5 rounded-full bg-primary-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full h-28 rounded-lg border border-slate-200 bg-gradient-to-br from-primary-50 to-violet-50 flex flex-col items-center justify-center gap-1">
                  <Palette className="h-6 w-6 text-primary-400" />
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-primary-200/60" />
                    <div className="w-6 h-1.5 rounded bg-primary-300/60" />
                    <div className="w-3 h-3 rounded-full bg-violet-200/60" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Personnalisé</p>
                  <p className="text-xs text-slate-400 mt-0.5">Éditeur visuel drag & drop.</p>
                </div>
              </div>
            </button>
          </div>
          {coverTemplate === "custom" && (
            <a href="/settings/cover-editor" target="_blank" className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
              <Palette className="h-4 w-4" /> Ouvrir l&apos;éditeur visuel
            </a>
          )}
        </div>

        {/* Corporate-specific settings */}
        {coverTemplate === "corporate" && (
          <div className="rounded-lg border border-primary-100 bg-primary-50/30 p-4 space-y-5">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Options du modèle Corporate</p>

            {/* Textes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Titre</label>
                <input type="text" value={corporateTitle} onChange={(e) => setCorporateTitle(e.target.value)} placeholder="Rapport client" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Accroche</label>
                <input type="text" value={corporateTagline} onChange={(e) => setCorporateTagline(e.target.value)} placeholder="Ex: Suivi des garanties et échéances" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>

            {/* Logos */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Logos</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hauteur max ({corpLogoHeight}px)</label>
                  <input type="range" min="40" max="200" value={corpLogoHeight} onChange={(e) => setCorpLogoHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Espacement ({corpLogoGap}px)</label>
                  <input type="range" min="10" max="80" value={corpLogoGap} onChange={(e) => setCorpLogoGap(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>

            {/* Trait vertical (séparateur logos) */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Trait vertical (entre les logos)</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hauteur ({corpDividerHeight}px)</label>
                  <input type="range" min="20" max="150" value={corpDividerHeight} onChange={(e) => setCorpDividerHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Épaisseur ({corpDividerWidth}px)</label>
                  <input type="range" min="0.5" max="5" step="0.5" value={corpDividerWidth} onChange={(e) => setCorpDividerWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={corpDividerColor || reportPrimaryColor} onChange={(e) => setCorpDividerColor(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                    <button onClick={() => setCorpDividerColor("")} className="text-xs text-slate-400 hover:text-slate-600">Auto</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Taille et couleur du titre */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Titre principal</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille ({corpTitleSize}px)</label>
                  <input type="range" min="20" max="60" value={corpTitleSize} onChange={(e) => setCorpTitleSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                  <input type="color" value={corpTitleColor} onChange={(e) => setCorpTitleColor(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Nom du client */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Nom du client</p>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Taille ({corpNameSize}px)</label>
                <input type="range" min="16" max="50" value={corpNameSize} onChange={(e) => setCorpNameSize(e.target.value)} className="w-full accent-primary-600" />
              </div>
            </div>

            {/* Ligne horizontale */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Trait horizontal</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largeur ({corpHrWidth}px)</label>
                  <input type="range" min="50" max="500" value={corpHrWidth} onChange={(e) => setCorpHrWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Épaisseur ({corpHrHeight}px)</label>
                  <input type="range" min="1" max="6" value={corpHrHeight} onChange={(e) => setCorpHrHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>

            {/* Accroche et date */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Accroche et date</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille accroche ({corpTaglineSize}px)</label>
                  <input type="range" min="10" max="24" value={corpTaglineSize} onChange={(e) => setCorpTaglineSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille date ({corpDateSize}px)</label>
                  <input type="range" min="10" max="22" value={corpDateSize} onChange={(e) => setCorpDateSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Executive-specific settings */}
        {coverTemplate === "executive" && (
          <div className="rounded-lg border border-primary-100 bg-primary-50/30 p-4 space-y-5">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider">Options du modèle Executive</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Titre</label>
                <input type="text" value={execTitle} onChange={(e) => setExecTitle(e.target.value)} placeholder="Rapport client" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Sous-titre</label>
                <input type="text" value={execSubtitle} onChange={(e) => setExecSubtitle(e.target.value)} placeholder="Ex: Suivi des garanties informatiques" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Bande diagonale</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largeur ({execBandWidth}%)</label>
                  <input type="range" min="25" max="65" value={execBandWidth} onChange={(e) => setExecBandWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Inclinaison ({execBandAngle}deg)</label>
                  <input type="range" min="5" max="25" value={execBandAngle} onChange={(e) => setExecBandAngle(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Couleur</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={execBandColor || reportPrimaryColor} onChange={(e) => setExecBandColor(e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                    <button onClick={() => setExecBandColor("")} className="text-xs text-slate-400 hover:text-slate-600">Auto</button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Typographie</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille titre ({execTitleSize}px)</label>
                  <input type="range" min="28" max="64" value={execTitleSize} onChange={(e) => setExecTitleSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Taille sous-titre ({execSubtitleSize}px)</label>
                  <input type="range" min="12" max="28" value={execSubtitleSize} onChange={(e) => setExecSubtitleSize(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Trait d&apos;accent</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Largeur ({execAccentWidth}px)</label>
                  <input type="range" min="30" max="120" value={execAccentWidth} onChange={(e) => setExecAccentWidth(e.target.value)} className="w-full accent-primary-600" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Épaisseur ({execAccentHeight}px)</label>
                  <input type="range" min="2" max="8" value={execAccentHeight} onChange={(e) => setExecAccentHeight(e.target.value)} className="w-full accent-primary-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Logo de votre société
          </label>
          <div className="flex items-center gap-4">
            {companyLogo ? (
              <div className="relative group">
                <img
                  src={companyLogo}
                  alt="Logo société"
                  className="h-20 w-auto max-w-[200px] rounded-lg bg-white p-2 border border-slate-200 object-contain"
                />
                <button
                  onClick={() => setCompanyLogo("")}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => companyLogoRef.current?.click()}
                className="flex h-20 w-40 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Ajouter un logo</span>
              </button>
            )}
            {companyLogo && (
              <button
                onClick={() => companyLogoRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Changer
              </button>
            )}
          </div>
          <input
            ref={companyLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { alert("Max 2 Mo"); return; }
              const reader = new FileReader();
              reader.onload = () => setCompanyLogo(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Ce logo apparaîtra sur la page de garde du rapport (max 2 Mo)</p>
        </div>

        {companyLogo && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Position du logo société
              </label>
              <select
                value={companyLogoPosition}
                onChange={(e) => setCompanyLogoPosition(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
              >
                <option value="top-left">Gauche</option>
                <option value="top-center">Centre</option>
                <option value="top-right">Droite</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Taille ({companyLogoSize}px)
              </label>
              <input
                type="range"
                min="60"
                max="400"
                step="10"
                value={companyLogoSize}
                onChange={(e) => setCompanyLogoSize(e.target.value)}
                className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Hauteur ({companyLogoTop}%)
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={companyLogoTop}
                onChange={(e) => setCompanyLogoTop(e.target.value)}
                className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Position du logo client
            </label>
            <select
              value={clientLogoPosition}
              onChange={(e) => setClientLogoPosition(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
            >
              <option value="top-left">Gauche</option>
              <option value="top-center">Centre</option>
              <option value="top-right">Droite</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Logo défini sur la fiche client</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Taille ({clientLogoSize}px)
            </label>
            <input
              type="range"
              min="60"
              max="400"
              step="10"
              value={clientLogoSize}
              onChange={(e) => setClientLogoSize(e.target.value)}
              className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Hauteur ({clientLogoTop}%)
            </label>
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={clientLogoTop}
              onChange={(e) => setClientLogoTop(e.target.value)}
              className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Image de fond de la page de garde
          </label>
          <div className="flex items-center gap-4">
            {reportCoverBg ? (
              <div className="relative group">
                <img
                  src={reportCoverBg}
                  alt="Fond page de garde"
                  className="h-24 w-auto max-w-[300px] rounded-lg bg-white border border-slate-200 object-cover"
                />
                <button
                  onClick={() => setReportCoverBg("")}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => reportCoverBgRef.current?.click()}
                className="flex h-24 w-48 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary-500 hover:text-primary-600 transition-colors"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Ajouter une image</span>
              </button>
            )}
            {reportCoverBg && (
              <button
                onClick={() => reportCoverBgRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Changer
              </button>
            )}
          </div>
          <input
            ref={reportCoverBgRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { alert("Max 5 Mo"); return; }
              const reader = new FileReader();
              reader.onload = () => setReportCoverBg(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
          <p className="text-xs text-slate-400 mt-1">Image affichée en fond de la première page du rapport (max 5 Mo, recommandé : 1920x1080)</p>
        </div>

        {reportCoverBg && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Opacité de l&apos;image de fond ({reportCoverBgOpacity}%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="100"
                value={reportCoverBgOpacity}
                onChange={(e) => setReportCoverBgOpacity(e.target.value)}
                className="flex-1 h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
              />
              <input
                type="number"
                min="5"
                max="100"
                value={reportCoverBgOpacity}
                onChange={(e) => setReportCoverBgOpacity(e.target.value)}
                className="w-16 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-center text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Contrôle la transparence de l&apos;image de fond (5% = très transparent, 100% = opaque)</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Nom de votre société
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ex: CEDELIA"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-xs text-slate-400 mt-1">Nom affiché dans l&apos;en-tête du rapport</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Titre du rapport
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Rapport de suivi des garanties"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Sous-titre
          </label>
          <input
            type="text"
            value={reportSubtitle}
            onChange={(e) => setReportSubtitle(e.target.value)}
            placeholder="Ex: CEDELIA - Solutions informatiques"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Message de la page de garde
          </label>
          <textarea
            value={reportMessage}
            onChange={(e) => setReportMessage(e.target.value)}
            placeholder="Ex: Document confidentiel — Suivi des garanties et échéances de vos produits installés."
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Classement des produits dans le rapport
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setReportGroupMode("date")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportGroupMode === "date"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Par date de fin
            </button>
            <button
              onClick={() => setReportGroupMode("family")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportGroupMode === "family"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Par famille
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Détermine comment les produits sont organisés dans le rapport imprimé</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Couleur principale du rapport
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={reportPrimaryColor}
              onChange={(e) => setReportPrimaryColor(e.target.value)}
              className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer"
            />
            <input
              type="text"
              value={reportPrimaryColor}
              onChange={(e) => setReportPrimaryColor(e.target.value)}
              className="w-32 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              onClick={() => setReportPrimaryColor("#3b82f6")}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Couleur utilisée pour le nom du client, les en-têtes et les accents du rapport</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Orientation de la page
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setReportOrientation("portrait")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportOrientation === "portrait"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Portrait
            </button>
            <button
              onClick={() => setReportOrientation("landscape")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                reportOrientation === "landscape"
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300"
              }`}
            >
              Paysage
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Éléments visibles dans le rapport
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowStats}
                onChange={(e) => setReportShowStats(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Cartes statistiques (Total, En parc, Hors parc, Renouvelé)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowFamily}
                onChange={(e) => setReportShowFamily(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Famille&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowSupplier}
                onChange={(e) => setReportShowSupplier(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Fournisseur&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowDuration}
                onChange={(e) => setReportShowDuration(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Durée&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowVerticalName}
                onChange={(e) => setReportShowVerticalName(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Nom du client vertical sur la page de garde</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowDate}
                onChange={(e) => setReportShowDate(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Date sur la page de garde</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportIncludeHorsParc}
                onChange={(e) => setReportIncludeHorsParc(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Inclure les produits hors parc dans le rapport</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowRenewedCount}
                onChange={(e) => setReportShowRenewedCount(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Afficher le nombre de produits renouvelés dans le rapport</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowQuantity}
                onChange={(e) => setReportShowQuantity(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Quantité&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowComParc}
                onChange={(e) => setReportShowComParc(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Com Parc&quot;</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowHeaderRow}
                onChange={(e) => setReportShowHeaderRow(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Ligne d&apos;en-têtes de colonnes (Produit, Qté, Com., Parc, etc.)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportShowStatus}
                onChange={(e) => setReportShowStatus(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Colonne &quot;Statut&quot; (En parc, Toujours en parc, Hors parc)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reportIncludeRenewed}
                onChange={(e) => setReportIncludeRenewed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">Inclure les produits renouvelés</span>
            </label>

          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Texte de pied de page
          </label>
          <input
            type="text"
            value={reportFooterText}
            onChange={(e) => setReportFooterText(e.target.value)}
            placeholder="Ex: CEDELIA - Document confidentiel"
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="text-xs text-slate-400 mt-1">Affiché en bas de chaque page du rapport</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSaveReport}
            disabled={savingReport}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {savingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {savedReport && <span className="text-xs text-emerald-600">Paramètres enregistrés</span>}
        </div>
      </div>}
      </div>
      </>);
}
