import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ContractPdfModel = {
  contractNumber: string;
  status: string;
  clientName: string;
  clientEmail?: string | null;
  projectName?: string | null;
  venue?: string | null;
  eventDate?: string | null;
  content?: string | null;
  signedAt?: string | null;
};

function wrap(text: string, maxChars = 95) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function generateContractPdf(model: ContractPdfModel): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const heading = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const accent = rgb(0.03, 0.22, 0.39);
  const secondary = rgb(0.81, 0.29, 0.31);
  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.37, 0.39, 0.41);
  let y = 740;

  const drawHeader = () => {
    page.drawText("CONTRACT", { x: 54, y, size: 34, font: heading, color: accent });
    y -= 22;
    page.drawText("Bridget Pope Designs", { x: 54, y, size: 13, font: heading, color: ink });
    y -= 16;
    page.drawText(model.contractNumber, { x: 54, y, size: 11, font: body, color: muted });
    page.drawText(model.status.toUpperCase(), {
      x: 612 - 54 - heading.widthOfTextAtSize(model.status.toUpperCase(), 10),
      y: 740,
      size: 10,
      font: heading,
      color: secondary,
    });
    y -= 18;
    page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1.5, color: secondary });
    y -= 22;
  };

  drawHeader();
  page.drawText(`Client: ${model.clientName}`, { x: 54, y, size: 11, font: body, color: ink });
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
  if (model.signedAt) {
    page.drawText(`Signed: ${model.signedAt}`, { x: 54, y, size: 10, font: body, color: muted });
    y -= 14;
  }

  y -= 8;
  const content = model.content?.trim() || "This contract confirms the design services outlined for your event with Bridget Pope Designs.";
  for (const paragraph of content.split(/\n+/)) {
    for (const line of wrap(paragraph)) {
      if (y < 72) {
        page = pdf.addPage([612, 792]);
        y = 740;
        drawHeader();
      }
      page.drawText(line, { x: 54, y, size: 10, font: body, color: ink });
      y -= 13;
    }
    y -= 8;
  }

  page.drawText("Bridget Pope Designs · Event Design Agreement", { x: 54, y: 40, size: 9, font: body, color: muted });
  return Buffer.from(await pdf.save());
}
