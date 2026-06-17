interface Installation {
  id: string;
  status: string;
  alwaysInFleet: boolean;
  comParc: string | null;
  startDate: string;
  endDate: string;
  durationMonths: number;
  quantity: number;
  supplier: string | null;
  family: string | null;
  product: { id: string; name: string; code: string | null };
  invoice: { id: string; invoiceNumber: string | null; invoiceDate: string } | null;
}

interface ReportClient {
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  logoUrl: string | null;
  installations: Installation[];
}

export function buildReportHtml(
  client: ReportClient,
  reportSettings: Record<string, string>,
  formatDate: (d: string) => string,
): string {
  function esc(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const title = esc(reportSettings.report_title || "Rapport de suivi des garanties");
  const subtitle = esc(reportSettings.report_subtitle || "");
  const message = esc(reportSettings.report_message || "");
  const companyLogo = reportSettings.company_logo || "";
  const companyName = esc(reportSettings.company_name || "");
  const showVerticalName = reportSettings.report_show_vertical_name !== "false";
  const groupByFamily = reportSettings.report_group_mode === "family";
  const primaryColor = reportSettings.report_primary_color || "#3b82f6";
  const showStats = reportSettings.report_show_stats !== "false";
  const showFamily = reportSettings.report_show_family !== "false";
  const showSupplier = reportSettings.report_show_supplier !== "false";
  const showDuration = reportSettings.report_show_duration !== "false";
  const footerText = esc(reportSettings.report_footer_text || "");
  const orientation = reportSettings.report_orientation || "portrait";
  const includeHorsParc = reportSettings.report_include_hors_parc !== "false";
  const showRenewedCount = reportSettings.report_show_renewed_count === "true";
  const coverBg = reportSettings.report_cover_bg || "";
  const coverBgOpacity = parseInt(reportSettings.report_cover_bg_opacity || "15") / 100;
  const showQuantity = reportSettings.report_show_quantity === "true";
  const showComParc = reportSettings.report_show_com_parc === "true";
  const showHeaderRow = reportSettings.report_show_header_row !== "false";
  const showStatus = reportSettings.report_show_status !== "false";
  const includeRenewed = reportSettings.report_include_renewed === "true";
  const companyLogoPosition = reportSettings.report_company_logo_position || "top-center";
  const companyLogoSizePx = parseInt(reportSettings.report_company_logo_size || "180");
  const companyLogoTopPct = parseInt(reportSettings.report_company_logo_top || "5");
  const clientLogoPosition = reportSettings.report_client_logo_position || "center";
  const clientLogoSizePx = parseInt(reportSettings.report_client_logo_size || "150");
  const clientLogoTopPct = parseInt(reportSettings.report_client_logo_top || "70");
  const showDate = reportSettings.report_show_date !== "false";
  const coverTemplate = reportSettings.report_cover_template || "classic";
  const corporateTitle = esc(reportSettings.report_corporate_title || "Rapport client");
  const corporateTagline = esc(reportSettings.report_corporate_tagline || "");
  const corpLogoHeight = parseInt(reportSettings.report_corp_logo_height || "90");
  const corpLogoGap = parseInt(reportSettings.report_corp_logo_gap || "28");
  const corpDividerHeight = parseInt(reportSettings.report_corp_divider_height || "70");
  const corpDividerWidth = parseFloat(reportSettings.report_corp_divider_width || "1.5");
  const corpDividerColor = reportSettings.report_corp_divider_color || primaryColor;
  const corpTitleSize = parseInt(reportSettings.report_corp_title_size || "36");
  const corpTitleColor = reportSettings.report_corp_title_color || "#1e293b";
  const corpNameSize = parseInt(reportSettings.report_corp_name_size || "26");
  const corpHrWidth = parseInt(reportSettings.report_corp_hr_width || "200");
  const corpHrHeight = parseInt(reportSettings.report_corp_hr_height || "2");
  const corpTaglineSize = parseInt(reportSettings.report_corp_tagline_size || "15");
  const corpDateSize = parseInt(reportSettings.report_corp_date_size || "14");
  const execBandAngle = parseInt(reportSettings.report_exec_band_angle || "12");
  const execBandWidth = parseInt(reportSettings.report_exec_band_width || "45");
  const execBandColor = reportSettings.report_exec_band_color || primaryColor;
  const execTitleSize = parseInt(reportSettings.report_exec_title_size || "44");
  const execSubtitleSize = parseInt(reportSettings.report_exec_subtitle_size || "18");
  const execTitle = esc(reportSettings.report_exec_title || "Rapport client");
  const execSubtitle = esc(reportSettings.report_exec_subtitle || "");
  const execAccentWidth = parseInt(reportSettings.report_exec_accent_width || "60");
  const execAccentHeight = parseInt(reportSettings.report_exec_accent_height || "4");
  const hasClientLogo = !!client.logoUrl;
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const todayShort = new Date().toLocaleDateString("fr-FR");

  const reportInstallations = client.installations.filter(i => {
    if (i.status === "RENOUVELE" && !includeRenewed) return false;
    if (!includeHorsParc && (i.status === "HORS_PARC")) return false;
    return true;
  });

  function buildCustomCover(): string {
    try {
      const raw = reportSettings.report_cover_layout;
      if (!raw) return "";
      const layout = JSON.parse(raw);
      if (!layout.elements) return "";

      function resolveVar(s: string): string {
        return s
          .replace(/\{\{client_name\}\}/g, esc(client.name))
          .replace(/\{\{company_name\}\}/g, esc(companyName))
          .replace(/\{\{date\}\}/g, todayShort)
          .replace(/\{\{date_long\}\}/g, today)
          .replace(/\{\{nb_installations\}\}/g, String(reportInstallations.length))
          .replace(/\{\{nb_en_parc\}\}/g, String(reportInstallations.filter(i => i.status === "EN_PARC").length))
          .replace(/\{\{nb_hors_parc\}\}/g, String(reportInstallations.filter(i => i.status === "HORS_PARC").length))
          .replace(/\{\{company_logo\}\}/g, companyLogo);
      }

      const bg = layout.background || "#ffffff";
      let bgImgHtml = "";
      if (layout.backgroundImage) {
        bgImgHtml = `<div style="position:absolute;inset:0;background-image:url('${layout.backgroundImage}');background-size:cover;background-position:center;opacity:${layout.backgroundOpacity ?? 0.15};"></div>`;
      }

      const elHtml = (layout.elements as Array<Record<string, unknown>>).map((el: Record<string, unknown>) => {
        const style = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;height:${el.height}%;${el.rotation ? `transform:rotate(${el.rotation}deg);` : ""}`;

        if (el.type === "text") {
          const content = resolveVar(String(el.content || ""));
          return `<div style="${style}display:flex;align-items:center;justify-content:${el.textAlign === "left" ? "flex-start" : el.textAlign === "right" ? "flex-end" : "center"};font-size:${el.fontSize || 16}px;font-weight:${el.fontWeight || "400"};font-style:${el.fontStyle || "normal"};color:${el.color || "#000"};text-align:${el.textAlign || "center"};letter-spacing:${el.letterSpacing || 0}px;text-transform:${el.textTransform || "none"};line-height:${el.lineHeight || 1.3};opacity:${el.opacity ?? 1};overflow:hidden;">${content}</div>`;
        }
        if (el.type === "rect" || el.type === "line") {
          return `<div style="${style}background-color:${el.backgroundColor || primaryColor};border-radius:${el.borderRadius ?? 0}px;${el.borderWidth ? `border:${el.borderWidth}px solid ${el.borderColor || "#000"};` : ""}opacity:${el.opacity ?? 1};"></div>`;
        }
        if (el.type === "circle") {
          return `<div style="${style}background-color:${el.backgroundColor || primaryColor};border-radius:50%;${el.borderWidth ? `border:${el.borderWidth}px solid ${el.borderColor || "#000"};` : ""}opacity:${el.opacity ?? 1};"></div>`;
        }
        if (el.type === "image") {
          const src = resolveVar(String(el.src || ""));
          if (!src) return `<div style="${style}"></div>`;
          return `<div style="${style}display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${src}" style="max-width:100%;max-height:100%;object-fit:${el.objectFit || "contain"};opacity:${el.opacity ?? 1};" /></div>`;
        }
        return "";
      }).join("\n    ");

      return `<div style="position:relative;width:100%;height:${orientation === "landscape" ? "210mm" : "297mm"};background:${bg};overflow:hidden;margin:0;">
    ${bgImgHtml}
    ${elHtml}
  </div>`;
    } catch {
      return "";
    }
  }

  function getReportStatusLabel(status: string, endDate: string, alwaysInFleet?: boolean): string {
    if (alwaysInFleet) return "Toujours en parc";
    if (status === "EN_PARC") {
      const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days > 0 && days <= 90) return `En parc (${days}j)`;
      return "En parc";
    }
    if (status === "HORS_PARC") return "Hors parc";
    if (status === "RENOUVELE") return "Renouvelé";
    return status;
  }

  function getStatusStyle(status: string, endDate: string, alwaysInFleet?: boolean): string {
    if (alwaysInFleet) return "color: #6b7280; font-weight: 700;";
    const expired = new Date(endDate).getTime() < Date.now();
    if (status === "RENOUVELE") return "color: #2563eb; font-weight: 700;";
    if (status === "HORS_PARC") return "color: #dc2626; font-weight: 700;";
    if (expired) return "color: #dc2626; font-weight: 700;";
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 90) return "color: #ea580c; font-weight: 700;";
    return "color: #16a34a; font-weight: 700;";
  }

  function getEndDateBgStyle(status: string, endDate: string, alwaysInFleet?: boolean): string {
    if (alwaysInFleet) return "background-color: #e5e7eb;";
    const expired = new Date(endDate).getTime() < Date.now();
    if (status === "HORS_PARC" || expired) return "background-color: #fecaca;";
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 90) return "background-color: #fed7aa;";
    return "background-color: #bbf7d0;";
  }

  function buildInstRows(installations: Installation[]): string {
    return installations.map((inst) => {
      const name = inst.product.name.length > 50 ? inst.product.name.slice(0, 50) + "…" : inst.product.name;
      return `
        <tr>
          <td>${esc(name)}</td>
          ${showFamily ? `<td>${esc(inst.family || "—")}</td>` : ""}
          ${showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
          ${showComParc ? `<td style="white-space:normal;word-wrap:break-word;text-align:left;">${esc(inst.comParc || "—")}</td>` : ""}
          ${showQuantity ? `<td>${inst.quantity}</td>` : ""}
          <td>${formatDate(inst.startDate)}</td>
          <td style="${getEndDateBgStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${formatDate(inst.endDate)}</td>
          ${showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
          ${showStatus ? `<td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getReportStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>` : ""}
        </tr>
      `;}).join("");
  }

  function buildColgroup(includeFamily: boolean): string {
    const colW = 80;
    const narrow = 45;
    const comParcW = 140;
    let fixedCols = 2;
    if (includeFamily) fixedCols++;
    if (showSupplier) fixedCols++;
    if (showQuantity) fixedCols++;
    if (showDuration) fixedCols++;
    if (showStatus) fixedCols++;
    let fixedWidth = fixedCols * colW + (showQuantity ? narrow - colW : 0);
    if (showComParc) fixedWidth += comParcW;
    return `<colgroup><col style="width: calc(100% - ${fixedWidth}px);" />${includeFamily ? `<col style="width: ${colW}px;" />` : ""}${showSupplier ? `<col style="width: ${colW}px;" />` : ""}${showComParc ? `<col style="width: ${comParcW}px;" />` : ""}${showQuantity ? `<col style="width: ${narrow}px;" />` : ""}<col style="width: ${colW}px;" /><col style="width: ${colW}px;" />${showDuration ? `<col style="width: ${colW}px;" />` : ""}${showStatus ? `<col style="width: ${colW}px;" />` : ""}</colgroup>`;
  }

  function buildTableHead(includeFamily: boolean): string {
    if (!showHeaderRow) return "";
    return `<thead><tr>
        <th>Produit</th>
        ${includeFamily ? `<th>Famille</th>` : ""}
        ${showSupplier ? `<th>Fournisseur</th>` : ""}
        ${showComParc ? `<th>Com. Parc</th>` : ""}
        ${showQuantity ? `<th>Qté</th>` : ""}
        <th>Début</th>
        <th>Fin</th>
        ${showDuration ? `<th>Durée</th>` : ""}
        ${showStatus ? `<th>Statut</th>` : ""}
      </tr></thead>`;
  }

  let tableContent = "";
  if (groupByFamily) {
    const families = new Map<string, Installation[]>();
    reportInstallations.forEach((inst) => {
      const fam = inst.family || "Autre";
      if (!families.has(fam)) families.set(fam, []);
      families.get(fam)!.push(inst);
    });
    const sortedFamilies = Array.from(families.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    tableContent = sortedFamilies.map(([family, installs], idx) => `
        <div style="margin-top: ${idx === 0 ? 6 : 8}px;">
          <h3 style="font-size: 12px; font-weight: 700; color: ${primaryColor}; margin-bottom: 2px; padding: 3px 8px; background: ${primaryColor}11; border-radius: 3px;">${esc(family)} (${installs.length})</h3>
          <table>
            ${buildColgroup(false)}
            ${buildTableHead(false)}
            <tbody>
              ${installs.map((inst) => { const name = inst.product.name.length > 50 ? inst.product.name.slice(0, 50) + "…" : inst.product.name; return `
                <tr>
                  <td>${esc(name)}</td>
                  ${showSupplier ? `<td>${esc(inst.supplier || "—")}</td>` : ""}
                  ${showComParc ? `<td style="white-space:normal;word-wrap:break-word;text-align:left;">${esc(inst.comParc || "—")}</td>` : ""}
                  ${showQuantity ? `<td>${inst.quantity}</td>` : ""}
                  <td>${formatDate(inst.startDate)}</td>
                  <td style="${getEndDateBgStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${formatDate(inst.endDate)}</td>
                  ${showDuration ? `<td>${inst.durationMonths} mois</td>` : ""}
                  ${showStatus ? `<td style="${getStatusStyle(inst.status, inst.endDate, inst.alwaysInFleet)}">${getReportStatusLabel(inst.status, inst.endDate, inst.alwaysInFleet)}</td>` : ""}
                </tr>
              `;}).join("")}
            </tbody>
          </table>
        </div>
      `).join("");
  } else {
    const sorted = [...reportInstallations].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    tableContent = `
        <table>
          ${buildColgroup(showFamily)}
          ${buildTableHead(showFamily)}
          <tbody>
            ${buildInstRows(sorted)}
          </tbody>
        </table>
      `;
  }

  const enParc = reportInstallations.filter(i => i.status === "EN_PARC");
  const horsParc = reportInstallations.filter(i => i.status === "HORS_PARC");
  const renewedCount = client.installations.filter(i => i.status === "RENOUVELE").length;

  const clientLogoHtml = client.logoUrl
    ? `<img src="${client.logoUrl}" alt="Logo client" style="max-width: ${clientLogoSizePx}px; max-height: ${Math.round(clientLogoSizePx * 0.67)}px; object-fit: contain;" />`
    : "";
  const companyLogoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="Logo société" style="max-width: ${companyLogoSizePx}px; max-height: ${Math.round(companyLogoSizePx * 0.67)}px; object-fit: contain;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="fr" style="background:#ffffff;">
<head>
  <meta charset="UTF-8" />
  <title>Rapport de suivi des garanties informatique - ${esc(client.name)}</title>
  <style>
    @media print {
      @page { margin: 5mm; size: ${orientation === "landscape" ? "landscape" : "portrait"}; }
      @page:first { margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      html, body { background: #ffffff !important; }
      .cover-bg img { filter: brightness(1.03) saturate(1.02); }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { background: #ffffff; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; background: #ffffff; }

    .cover-page {
      position: relative;
      width: 100%;
      height: ${orientation === "landscape" ? "210mm" : "297mm"};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: #ffffff;
      color: #1a1a2e;
      padding: 20px;
      overflow: hidden;
      margin: 0;
    }
    .cover-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }
    .cover-bg img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      opacity: ${coverBgOpacity};
    }
    .cover-page > *:not(.cover-bg):not(.cover-logo-abs):not(.vertical-text) { position: relative; z-index: 1; }
    .cover-logo-abs { position: absolute; z-index: 1; }
    .cover-logo-abs img { object-fit: contain; }
    .cover-page h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
    .cover-page .client-name { font-size: 42px; font-weight: 800; color: ${primaryColor}; margin-bottom: 30px; }
    .cover-page .subtitle { font-size: 18px; color: #64748b; margin-bottom: 8px; }
    .cover-page .date { font-size: 16px; color: #94a3b8; margin-top: 40px; }
    .cover-page .message { font-size: 14px; color: #64748b; margin-top: 20px; max-width: 500px; line-height: 1.6; }
    .cover-page .vertical-text { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: mixed; font-size: 17px; font-weight: 800; color: ${primaryColor}90; letter-spacing: 5px; text-transform: uppercase; white-space: nowrap; }

    /* Corporate template */
    .corporate-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 0; }
    .corporate-logos { display: flex; align-items: center; justify-content: center; gap: ${corpLogoGap}px; margin-bottom: 40px; }
    .corporate-logos img { max-height: ${corpLogoHeight}px; max-width: ${Math.round(corpLogoHeight * 2)}px; object-fit: contain; }
    .corporate-logos .logo-divider { width: ${corpDividerWidth}px; height: ${corpDividerHeight}px; background: ${corpDividerColor}; flex-shrink: 0; }
    .corporate-title { font-size: ${corpTitleSize}px; font-weight: 300; color: ${corpTitleColor}; letter-spacing: 1px; margin-bottom: 20px; line-height: 1.2; }
    .corporate-client-name { font-size: ${corpNameSize}px; font-weight: 700; color: ${primaryColor}; margin-bottom: 24px; letter-spacing: 0.5px; }
    .corporate-hr { width: ${corpHrWidth}px; height: ${corpHrHeight}px; background: ${primaryColor}; border: none; margin: 0 auto 24px; }
    .corporate-tagline { font-size: ${corpTaglineSize}px; color: #64748b; font-style: italic; margin-bottom: 20px; letter-spacing: 0.5px; }
    .corporate-date { font-size: ${corpDateSize}px; color: #64748b; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; margin-top: 8px; }

    /* Executive template */
    .exec-cover { position: relative; width: 100%; height: ${orientation === "landscape" ? "210mm" : "297mm"}; background: #ffffff; overflow: hidden; margin: 0; display: flex; }
    .exec-band { position: absolute; top: 0; left: 0; width: ${execBandWidth}%; height: 100%; background: ${execBandColor}; transform-origin: top left; transform: skewX(-${execBandAngle}deg); z-index: 1; }
    .exec-band::after { content: ''; position: absolute; top: 0; right: -30px; width: 30px; height: 100%; background: ${execBandColor}30; }
    .exec-left { position: relative; z-index: 2; width: ${execBandWidth}%; display: flex; flex-direction: column; justify-content: flex-end; padding: 60px 50px; color: #ffffff; }
    .exec-left .exec-company-logo { position: absolute; top: 50px; left: 50px; }
    .exec-left .exec-company-logo img { max-height: 50px; max-width: 160px; object-fit: contain; filter: brightness(0) invert(1); }
    .exec-title { font-size: ${execTitleSize}px; font-weight: 800; line-height: 1.1; letter-spacing: -0.5px; margin-bottom: 16px; color: #ffffff; }
    .exec-accent { width: ${execAccentWidth}px; height: ${execAccentHeight}px; background: #ffffff; border-radius: 2px; margin-bottom: 20px; opacity: 0.8; }
    .exec-subtitle { font-size: ${execSubtitleSize}px; font-weight: 300; color: rgba(255,255,255,0.85); letter-spacing: 0.5px; line-height: 1.4; }
    .exec-right { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 60px 50px; }
    .exec-client-logo { margin-bottom: 30px; }
    .exec-client-logo img { max-height: 80px; max-width: 200px; object-fit: contain; }
    .exec-client-name { font-size: 28px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px; margin-bottom: 10px; }
    .exec-meta { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 40px; }
    .exec-meta-item { font-size: 12px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; }
    .exec-meta-value { font-size: 14px; color: #475569; font-weight: 600; letter-spacing: 0.3px; }
    .exec-dots { position: absolute; bottom: 40px; right: 40px; display: grid; grid-template-columns: repeat(5, 6px); gap: 6px; opacity: 0.15; z-index: 2; }
    .exec-dots span { width: 6px; height: 6px; border-radius: 50%; background: ${execBandColor}; }

    @media print { .cover-page, .exec-cover { page-break-after: always; } .report-content { background: #ffffff !important; } }

    .report-content { padding: 5mm; background: #ffffff; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0f172a; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; }

    .stats { display: flex; gap: 16px; margin-bottom: 30px; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 120px; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .stat-card .value { font-size: 28px; font-weight: 800; }
    .stat-card .label { font-size: 11px; color: #64748b; margin-top: 4px; }
    .stat-green { border-color: #10b981; } .stat-green .value { color: #10b981; }
    .stat-red { border-color: #ef4444; } .stat-red .value { color: #ef4444; }
    .stat-blue { border-color: ${primaryColor}; } .stat-blue .value { color: ${primaryColor}; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; padding-top: 20px; margin-top: 40px; border-top: 1px solid #e2e8f0; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 2px; table-layout: fixed; }
    th { background: #f1f5f9; padding: 2px 4px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #475569; white-space: nowrap; border-bottom: 2px solid #e2e8f0; }
    td { padding: 1px 4px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
    th:first-child, td:first-child { white-space: normal; word-wrap: break-word; }
    th:not(:first-child), td:not(:first-child) { text-align: center; padding: 1px 3px; }
    tr:nth-child(even) { background: #fafafa; }

    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .header-bar .client-info h2 { font-size: 22px; font-weight: 700; }
    .header-bar .client-info p { font-size: 12px; color: #64748b; }
    .header-bar .report-date { font-size: 12px; color: #64748b; text-align: right; }
  </style>
</head>
<body>
  ${coverTemplate === "custom" ? buildCustomCover() : coverTemplate === "executive" ? `<div class="exec-cover">
    ${coverBg ? `<div class="cover-bg"><img src="${coverBg}" alt="" /></div>` : ""}
    <div class="exec-band"></div>
    <div class="exec-left">
      ${companyLogo ? `<div class="exec-company-logo"><img src="${companyLogo}" alt="Logo société" /></div>` : ""}
      <div class="exec-title">${execTitle}</div>
      <div class="exec-accent"></div>
      ${execSubtitle ? `<div class="exec-subtitle">${execSubtitle}</div>` : ""}
    </div>
    <div class="exec-right">
      ${client.logoUrl ? `<div class="exec-client-logo"><img src="${client.logoUrl}" alt="Logo client" /></div>` : ""}
      <div class="exec-client-name">${esc(client.name)}</div>
      ${showDate ? `<div class="exec-meta">
        <div><span class="exec-meta-item">Date</span></div>
        <div><span class="exec-meta-value">${today}</span></div>
      </div>` : ""}
    </div>
    <div class="exec-dots">${Array(15).fill('<span></span>').join('')}</div>
  </div>` : coverTemplate === "corporate" ? `<div class="cover-page">
    ${coverBg ? `<div class="cover-bg"><img src="${coverBg}" alt="" /></div>` : ""}
    ${showVerticalName ? `<div class="vertical-text">${esc(client.name)}</div>` : ""}
    <div class="corporate-inner">
      ${(companyLogo || client.logoUrl) ? `<div class="corporate-logos">
        ${companyLogo ? `<img src="${companyLogo}" alt="Logo société" />` : ""}
        ${companyLogo && client.logoUrl ? `<div class="logo-divider"></div>` : ""}
        ${client.logoUrl ? `<img src="${client.logoUrl}" alt="Logo client" />` : ""}
      </div>` : ""}
      <div class="corporate-title">${corporateTitle}</div>
      <div class="corporate-client-name">${esc(client.name)}</div>
      <hr class="corporate-hr" />
      ${corporateTagline ? `<div class="corporate-tagline">${corporateTagline}</div>` : ""}
      ${showDate ? `<div class="corporate-date">${today}</div>` : ""}
    </div>
  </div>` : `<div class="cover-page">
    ${coverBg ? `<div class="cover-bg"><img src="${coverBg}" alt="" /></div>` : ""}
    ${showVerticalName ? `<div class="vertical-text">${esc(client.name)}</div>` : ""}
    ${companyLogoHtml ? (() => {
      const hAlign = companyLogoPosition === "top-left" ? "left: 30px;" : companyLogoPosition === "top-right" ? "right: 30px;" : "left: 50%; transform: translateX(-50%);";
      return `<div class="cover-logo-abs" style="top: ${companyLogoTopPct}%; ${hAlign}">${companyLogoHtml}</div>`;
    })() : ""}
    ${clientLogoHtml ? (() => {
      const hAlign = clientLogoPosition === "top-left" ? "left: 30px;" : clientLogoPosition === "top-right" ? "right: 30px;" : "left: 50%; transform: translateX(-50%);";
      return `<div class="cover-logo-abs" style="top: ${clientLogoTopPct}%; ${hAlign}">${clientLogoHtml}</div>`;
    })() : ""}
    <h1>${title}</h1>
    ${!hasClientLogo ? `<div class="client-name">${esc(client.name)}</div>` : ""}
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    ${showDate ? `<div class="date">${today}</div>` : ""}
    ${message ? `<div class="message">${message}</div>` : ""}
  </div>`}

  <div class="report-content">
    <div class="header-bar">
      <div class="client-info">
        <h2>${esc(client.name)}</h2>
        <p>${[client.email, client.phone, client.city].filter(Boolean).map(s => esc(s!)).join(" • ")}</p>
      </div>
      <div class="report-date">
        <p>Généré le ${today}</p>
        <p>${reportInstallations.length} installation(s)</p>
      </div>
    </div>

    ${showStats ? `<div class="stats">
      <div class="stat-card">
        <div class="value">${reportInstallations.length}</div>
        <div class="label">Total</div>
      </div>
      <div class="stat-card stat-green">
        <div class="value">${enParc.length}</div>
        <div class="label">En parc</div>
      </div>
      <div class="stat-card stat-red">
        <div class="value">${horsParc.length}</div>
        <div class="label">Hors parc</div>
      </div>
      ${showRenewedCount ? `<div class="stat-card stat-blue">
        <div class="value">${renewedCount}</div>
        <div class="label">Renouvelés</div>
      </div>` : ""}
    </div>` : ""}

    <div class="section-title">Détail des installations</div>
    ${tableContent}
    ${footerText ? `<div class="footer">${footerText}</div>` : ""}
  </div>

  <script>
    (function() {
      document.title = 'Rapport de suivi des garanties informatique - ${esc(client.name).replace(/'/g, "\\&#039;")}';
    })();
  </script>
</body>
</html>`;
}

export function printReport(
  client: ReportClient,
  reportSettings: Record<string, string>,
  formatDate: (d: string) => string,
): void {
  const html = buildReportHtml(client, reportSettings, formatDate);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export async function downloadPdf(
  client: ReportClient,
  reportSettings: Record<string, string>,
  formatDate: (d: string) => string,
): Promise<void> {
  const html = buildReportHtml(client, reportSettings, formatDate);
  const html2pdf = (await import("html2pdf.js")).default;
  const container = document.createElement("div");
  container.innerHTML = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) container.innerHTML = bodyMatch[1];
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    const style = document.createElement("style");
    style.textContent = styleMatch[1];
    container.prepend(style);
  }
  document.body.appendChild(container);
  const fileName = `rapport-${client.name.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}`;
  await html2pdf().set({
    margin: [0, 0, 0, 0],
    filename: `${fileName}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: reportSettings.report_orientation === "landscape" ? "landscape" : "portrait" },
  }).from(container).save();
  document.body.removeChild(container);
}
