import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { currency } from "@/lib/currency";

export type ProposalPdfItem = {
  title: string;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  total?: number | null;
};

export type ProposalPdfModel = {
  proposalNumber: string;
  title: string;
  status: string;
  introduction?: string | null;
  clientName: string;
  clientEmail?: string | null;
  projectName?: string | null;
  venue?: string | null;
  eventDate?: string | null;
  items: ProposalPdfItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  depositAmount: number;
  expirationDate?: string | null;
};

export async function generateProposalPdf(model: ProposalPdfModel): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const heading = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const accent = rgb(0.03, 0.22, 0.39);
  const secondary = rgb(0.81, 0.29, 0.31);
  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.37, 0.39, 0.41);
  let y = 740;

  page.drawText("PROPOSAL", { x: 54, y, size: 34, font: heading, color: accent });
  y -= 22;
  page.drawText("Bridget Pope Designs", { x: 54, y, size: 13, font: heading, color: ink });
  y -= 18;
  page.drawText(model.proposalNumber, { x: 54, y, size: 11, font: body, color: muted });
  page.drawText(model.status.toUpperCase(), {
    x: 612 - 54 - heading.widthOfTextAtSize(model.status.toUpperCase(), 10),
    y: 740,
    size: 10,
    font: heading,
    color: secondary,
  });
  y -= 20;
  page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1.5, color: secondary });
  y -= 24;

  page.drawText(model.title, { x: 54, y, size: 16, font: heading, color: ink });
  y -= 20;
  page.drawText(`Prepared for: ${model.clientName}`, { x: 54, y, size: 11, font: body, color: ink });
  y -= 14;
  if (model.clientEmail) {
    page.drawText(model.clientEmail, { x: 54, y, size: 10, font: body, color: muted });
    y -= 14;
  }
  if (model.projectName) {
    page.drawText(`Event: ${model.projectName}`, { x: 54, y, size: 10, font: body, color: ink });
    y -= 14;
  }
  if (model.venue) {
    page.drawText(`Venue: ${model.venue}`, { x: 54, y, size: 10, font: body, color: ink });
    y -= 14;
  }
  if (model.eventDate) {
    page.drawText(`Date: ${model.eventDate}`, { x: 54, y, size: 10, font: body, color: ink });
    y -= 14;
  }
  if (model.expirationDate) {
    page.drawText(`Valid through: ${model.expirationDate}`, { x: 54, y, size: 10, font: body, color: muted });
    y -= 14;
  }

  if (model.introduction) {
    y -= 8;
    for (const line of model.introduction.split(/\s+/).reduce<string[]>((lines, word) => {
      const current = lines[lines.length - 1] ?? "";
      const next = current ? `${current} ${word}` : word;
      if (body.widthOfTextAtSize(next, 10) > 500 && current) lines.push(word);
      else if (!lines.length) lines.push(word);
      else lines[lines.length - 1] = next;
      return lines;
    }, [])) {
      page.drawText(line, { x: 54, y, size: 10, font: body, color: ink });
      y -= 13;
    }
  }

  y -= 10;
  page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1.5, color: secondary });
  y -= 18;
  page.drawText("DESCRIPTION", { x: 54, y, size: 10, font: heading, color: accent });
  page.drawText("AMOUNT", { x: 500, y, size: 10, font: heading, color: accent });
  y -= 14;

  for (const item of model.items) {
    if (y < 120) break;
    page.drawText(item.title.slice(0, 70), { x: 54, y, size: 10, font: body, color: ink });
    const amount = currency(Number(item.total ?? (Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0))));
    page.drawText(amount, { x: 558 - body.widthOfTextAtSize(amount, 10), y, size: 10, font: body, color: ink });
    y -= 14;
    if (item.description) {
      page.drawText(item.description.slice(0, 90), { x: 54, y, size: 9, font: body, color: muted });
      y -= 12;
    }
  }

  y -= 10;
  page.drawLine({ start: { x: 320, y }, end: { x: 558, y }, thickness: 1, color: muted });
  y -= 16;
  const totals: Array<[string, string]> = [
    ["Subtotal", currency(model.subtotal)],
    ["Discount", currency(model.discountAmount)],
    ["Tax", currency(model.taxAmount)],
    ["Total", currency(model.total)],
    ["Deposit", currency(model.depositAmount)],
  ];
  for (const [label, value] of totals) {
    page.drawText(label, { x: 360, y, size: 10, font: heading, color: accent });
    page.drawText(value, { x: 558 - body.widthOfTextAtSize(value, 10), y, size: 10, font: body, color: ink });
    y -= 14;
  }

  page.drawText("Thank you for considering Bridget Pope Designs.", { x: 54, y: 48, size: 9, font: body, color: muted });
  return Buffer.from(await pdf.save());
}
