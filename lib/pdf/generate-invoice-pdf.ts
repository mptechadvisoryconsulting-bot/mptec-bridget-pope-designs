import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { currency } from "@/lib/currency";
import type { InvoiceRenderModel } from "@/lib/invoices/render-model";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;

function hexToRgb(hex: string | undefined, fallback: [number, number, number]) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? "");
  if (!match) return rgb(...fallback);
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      output.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) output.push(current);
  return output.length ? output : [""];
}

async function embedImageFromUrl(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("png") || url.toLowerCase().endsWith(".png")) {
      return await pdf.embedPng(bytes);
    }

    if (contentType.includes("jpeg") || contentType.includes("jpg") || /\.(jpe?g)$/i.test(url)) {
      return await pdf.embedJpg(bytes);
    }

    try {
      return await pdf.embedPng(bytes);
    } catch {
      return await pdf.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

/**
 * Generates the canonical invoice PDF from the shared InvoiceRenderModel. This is used
 * identically by the admin/client download route and the email-attachment send route so
 * totals can never diverge from the browser preview.
 */
export async function generateInvoicePdf(model: InvoiceRenderModel): Promise<Buffer> {
  const { template, totals, flags } = model;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const bodyFontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const accent = hexToRgb(template.accentColor, [0.03, 0.22, 0.39]);
  const secondary = hexToRgb(template.secondaryColor, [0.81, 0.29, 0.31]);
  const bodyColor = hexToRgb(template.bodyTextColor, [0.07, 0.07, 0.07]);
  const muted = rgb(0.37, 0.39, 0.41);

  const backgroundImage = await embedImageFromUrl(pdf, template.backgroundArtworkUrl);
  if (backgroundImage) {
    const opacity = Math.min(0.25, Math.max(0, template.backgroundOpacity ?? 0.06));
    const scale = Math.max(PAGE_WIDTH / backgroundImage.width, PAGE_HEIGHT / backgroundImage.height);
    page.drawImage(backgroundImage, {
      x: (PAGE_WIDTH - backgroundImage.width * scale) / 2,
      y: (PAGE_HEIGHT - backgroundImage.height * scale) / 2,
      width: backgroundImage.width * scale,
      height: backgroundImage.height * scale,
      opacity,
    });
  }

  let y = PAGE_HEIGHT - 64;

  const logoImage = await embedImageFromUrl(pdf, template.logoUrl);
  if (logoImage) {
    const logoHeight = 40;
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, { x: MARGIN_X, y: y - logoHeight + 10, width: logoWidth, height: logoHeight });
    y -= logoHeight + 6;
  }

  page.drawText(template.invoiceTitle.toUpperCase(), { x: MARGIN_X, y, size: 40, font: headingFont, color: accent });
  y -= 26;
  page.drawText(template.businessName, { x: MARGIN_X, y, size: 13, font: bodyFontBold, color: bodyColor });
  y -= 16;

  if (template.businessContactBlock) {
    for (const line of template.businessContactBlock.split("\n").filter(Boolean)) {
      page.drawText(line, { x: MARGIN_X, y, size: 9, font: bodyFont, color: muted });
      y -= 12;
    }
  }

  const statusLabel = model.isUpdatedVersion ? `${model.status.toUpperCase()} · v${model.versionNumber}` : model.status.toUpperCase();
  page.drawText(statusLabel, { x: PAGE_WIDTH - MARGIN_X - headingFont.widthOfTextAtSize(statusLabel, 10), y: PAGE_HEIGHT - 64, size: 10, font: headingFont, color: secondary });

  y -= 18;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_WIDTH - MARGIN_X, y }, thickness: 1.5, color: secondary });
  y -= 26;

  const metaTop = y;
  page.drawText(template.billToLabel ?? "Bill To", { x: MARGIN_X, y, size: 12, font: headingFont, color: accent });
  y -= 16;
  page.drawText(model.client.name, { x: MARGIN_X, y, size: 10, font: bodyFontBold, color: bodyColor });
  y -= 14;
  if (model.client.email) {
    page.drawText(model.client.email, { x: MARGIN_X, y, size: 10, font: bodyFont, color: bodyColor });
    y -= 14;
  }
  if (flags.showProject && model.project.name) {
    page.drawText(model.project.name, { x: MARGIN_X, y, size: 10, font: bodyFont, color: bodyColor });
    y -= 14;
  }
  if (flags.showVenue && model.project.venue) {
    page.drawText(model.project.venue, { x: MARGIN_X, y, size: 10, font: bodyFont, color: bodyColor });
    y -= 14;
  }

  let metaY = metaTop;
  const metaRows: Array<[string, string]> = [
    [template.invoiceNumberLabel ?? "Invoice #", model.invoiceNumber],
    [template.invoiceDateLabel ?? "Invoice Date", model.issueDateLabel],
  ];
  if (flags.showDueDate && model.dueDateLabel) {
    metaRows.push([template.dueDateLabel ?? "Due Date", model.dueDateLabel]);
  }

  for (const [label, value] of metaRows) {
    page.drawText(label, { x: 360, y: metaY, size: 11, font: headingFont, color: accent });
    page.drawText(value, { x: 360, y: metaY - 14, size: 10, font: bodyFont, color: bodyColor });
    metaY -= 34;
  }

  y = Math.min(y, metaY) - 12;

  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_WIDTH - MARGIN_X, y }, thickness: 2, color: secondary });
  y -= 16;
  page.drawText((template.itemsColumnLabel ?? "Description").toUpperCase(), { x: MARGIN_X, y, size: 10, font: headingFont, color: accent });
  page.drawText((template.amountColumnLabel ?? "Amount").toUpperCase(), { x: PAGE_WIDTH - MARGIN_X - 60, y, size: 10, font: headingFont, color: accent });
  y -= 6;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_WIDTH - MARGIN_X, y }, thickness: 2, color: secondary });
  y -= 20;

  let currentPage: PDFPage = page;

  function ensureSpace(minY: number) {
    if (y < minY) {
      currentPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 64;
    }
  }

  if (!model.items.length) {
    currentPage.drawText("No line items were added to this invoice.", { x: MARGIN_X, y, size: 10, font: bodyFont, color: muted });
    y -= 20;
  }

  for (const item of model.items) {
    ensureSpace(120);
    currentPage.drawText(item.title, { x: MARGIN_X, y, size: 11, font: bodyFontBold, color: bodyColor });
    const amountText = currency(item.total);
    currentPage.drawText(amountText, { x: PAGE_WIDTH - MARGIN_X - bodyFontBold.widthOfTextAtSize(amountText, 11), y, size: 11, font: bodyFontBold, color: bodyColor });
    y -= 14;

    if (item.description) {
      for (const line of wrapText(item.description, bodyFont, 9, 360)) {
        currentPage.drawText(line, { x: MARGIN_X, y, size: 9, font: bodyFont, color: muted });
        y -= 12;
      }
    }

    const detail = `${item.quantity} x ${currency(item.unitPrice)}`;
    currentPage.drawText(detail, { x: MARGIN_X, y, size: 9, font: bodyFont, color: muted });
    y -= (template.lineItemSpacing ?? 16) + 4;
  }

  ensureSpace(200);
  y -= 6;
  currentPage.drawLine({ start: { x: 340, y }, end: { x: PAGE_WIDTH - MARGIN_X, y }, thickness: 1, color: secondary });
  y -= 20;

  const summaryRows: Array<[string, number]> = [[template.subtotalLabel ?? "Subtotal", totals.subtotal]];
  if (flags.showDiscount) summaryRows.push([template.discountLabel ?? "Discount", totals.discount]);
  if (flags.showTax) summaryRows.push([template.taxLabel ?? "Tax", totals.tax]);
  if (flags.showAmountPaid) summaryRows.push([template.amountPaidLabel ?? "Amount Paid", totals.amountPaid]);
  summaryRows.push([template.balanceDueLabel ?? "Balance Due", totals.balanceDue]);

  for (const [label, value] of summaryRows) {
    const valueText = currency(value);
    currentPage.drawText(label, { x: 340, y, size: 10, font: headingFont, color: accent });
    currentPage.drawText(valueText, { x: PAGE_WIDTH - MARGIN_X - headingFont.widthOfTextAtSize(valueText, 10), y, size: 10, font: bodyFontBold, color: bodyColor });
    y -= 18;
  }

  currentPage.drawLine({ start: { x: 340, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN_X, y: y + 4 }, thickness: 1, color: secondary });
  const totalText = currency(totals.total);
  currentPage.drawText((template.totalLabel ?? "Total").toUpperCase(), { x: 340, y, size: 12, font: headingFont, color: accent });
  currentPage.drawText(totalText, { x: PAGE_WIDTH - MARGIN_X - headingFont.widthOfTextAtSize(totalText, 12), y, size: 12, font: headingFont, color: accent });
  y -= 40;

  ensureSpace(140);
  currentPage.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_WIDTH - MARGIN_X, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 22;

  if (template.thankYouText) {
    currentPage.drawText(template.thankYouText, { x: MARGIN_X, y, size: 14, font: bodyFontBold, color: accent });
    y -= 22;
  }

  currentPage.drawText(template.termsHeading ?? "Terms & Conditions", { x: MARGIN_X, y, size: 11, font: headingFont, color: secondary });
  y -= 16;
  for (const line of wrapText(template.paymentTerms, bodyFont, 9, PAGE_WIDTH - MARGIN_X * 2)) {
    currentPage.drawText(line, { x: MARGIN_X, y, size: 9, font: bodyFont, color: bodyColor });
    y -= 12;
  }

  if (template.footerText) {
    y -= 6;
    for (const line of wrapText(template.footerText, bodyFont, 8, PAGE_WIDTH - MARGIN_X * 2)) {
      currentPage.drawText(line, { x: MARGIN_X, y, size: 8, font: bodyFont, color: muted });
      y -= 11;
    }
  }

  return Buffer.from(await pdf.save());
}
