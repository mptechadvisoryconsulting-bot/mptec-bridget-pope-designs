import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InquiryInput } from "@/lib/validation/inquiry-schema";

type LeadRecord = {
  id: string;
  lead_number?: string | null;
  created_at?: string | null;
};

function lines(value: string, max = 86) {
  const words = value.split(/\s+/);
  const output: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > max) {
      output.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }

  if (current) output.push(current);
  return output;
}

export async function generateInquiryPdf({ lead, input }: { lead: LeadRecord; input: InquiryInput }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const gold = rgb(0.72, 0.5, 0.18);
  const blush = rgb(0.78, 0.36, 0.48);
  let y = 740;

  page.drawText("Bridget Pope Designs", { x: 54, y, size: 26, font: serifBold, color: rgb(0.05, 0.04, 0.03) });
  y -= 24;
  page.drawText("Consultation Request Summary", { x: 54, y, size: 13, font: sans, color: blush });
  page.drawLine({ start: { x: 54, y: y - 14 }, end: { x: 558, y: y - 14 }, thickness: 1, color: gold });
  y -= 46;

  const rows = [
    ["Lead", lead.lead_number ?? lead.id],
    ["Submitted", lead.created_at ?? new Date().toISOString()],
    ["Client", `${input.firstName} ${input.lastName}`],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Event", input.eventType],
    ["Event date", input.eventDate || "Not provided"],
    ["Venue", input.venue || "Not provided"],
    ["City", input.city || "Not provided"],
    ["Guest count", String(input.guestCount || "Not provided")],
    ["Budget", input.estimatedBudget || "Not provided"],
    ["Consultation", `${input.preferredConsultationMethod} ${input.preferredConsultationDate || ""} ${input.preferredConsultationTime || ""}`.trim()],
    ["Colors", input.eventColors || "Not provided"],
    ["Theme", input.eventTheme || "Not provided"],
    ["Services", input.servicesNeeded.join(", ")],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: 54, y, size: 10, font: serifBold, color: rgb(0.08, 0.06, 0.05) });
    page.drawText(value, { x: 180, y, size: 10, font: sans, color: rgb(0.18, 0.15, 0.13) });
    y -= 20;
  }

  y -= 10;
  page.drawText("Message", { x: 54, y, size: 12, font: serifBold, color: rgb(0.08, 0.06, 0.05) });
  y -= 18;
  for (const line of lines(input.message)) {
    page.drawText(line, { x: 54, y, size: 10, font: sans, color: rgb(0.18, 0.15, 0.13) });
    y -= 16;
  }

  if (input.inspirationFileNames.length) {
    y -= 10;
    page.drawText("Uploaded inspiration references", { x: 54, y, size: 12, font: serifBold });
    y -= 18;
    for (const fileName of input.inspirationFileNames) {
      page.drawText(`- ${fileName}`, { x: 54, y, size: 10, font: sans });
      y -= 15;
    }
  }

  return Buffer.from(await pdf.save());
}
