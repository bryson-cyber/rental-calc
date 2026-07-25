/**
 * PDF builder for demo formation documents — "engraved-classic legal" look:
 * serif body (Times), spaced-caps eyebrows, one gold accent, hairline rules,
 * label/value meta blocks, signature blocks, a fixed footer, and a large
 * diagonal SAMPLE watermark behind the content of every page.
 *
 * No dependencies: emits a valid PDF 1.4 file by hand using only the base-14
 * fonts (nothing to embed). Only used to fabricate clearly-watermarked
 * SAMPLE documents for webinar demo filings.
 */

/** Escape a string for a PDF literal string: backslashes and parentheses. */
function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Em dash is not latin1; StandardEncoding octal 0320 renders an emdash
    // with the built-in fonts.
    .replace(/—/g, "\\320")
    // Bullet: StandardEncoding octal 0267.
    .replace(/•/g, "\\267")
    // Anything else outside latin1 would corrupt the byte stream; degrade
    // gracefully to a space.
    .replace(/[^\x20-\x7e\\]/g, " ");
}

// Base-14 fonts available without embedding.
const FONTS = {
  sans: "F1", // Helvetica
  sansBold: "F2", // Helvetica-Bold
  serif: "F3", // Times-Roman
  serifBold: "F4", // Times-Bold
} as const;

// Palette — near-black text, warm gold accent, quiet grays.
const INK = "0.122 0.161 0.216"; // #1F2937
const MUTED = "0.42 0.447 0.502"; // #6B7280
const GOLD = "0.631 0.384 0.027"; // #A16207
const HAIRLINE = "0.82 0.835 0.859"; // #D1D5DB
const WATERMARK = "0.936 0.936 0.936";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const CONTENT_TOP = 716;
const FOOTER_Y = 60;

export type DemoPdfBlock =
  | { kind: "eyebrow"; text: string }
  | { kind: "title"; text: string }
  | { kind: "rule" }
  | { kind: "meta"; rows: Array<[string, string]> }
  | { kind: "heading"; text: string }
  | { kind: "para"; lines: string[] }
  | { kind: "space"; pt?: number }
  | { kind: "signature"; name: string; role: string; date: string };

export interface DemoPdfPageV2 {
  blocks: DemoPdfBlock[];
  /** "certificate" draws a double-rule gold border (Articles/EIN look). */
  border?: "certificate" | "none";
}

function text(
  out: string[],
  font: string,
  size: number,
  color: string,
  x: number,
  y: number,
  value: string,
  charSpacing = 0,
) {
  out.push(
    "BT",
    `/${font} ${size} Tf`,
    `${color} rg`,
    charSpacing ? `${charSpacing} Tc` : "0 Tc",
    `1 0 0 1 ${x} ${y} Tm`,
    `(${escapePdfText(value)}) Tj`,
    "ET",
  );
}

function rect(out: string[], color: string, x: number, y: number, w: number, h: number) {
  out.push(`${color} rg`, `${x} ${y} ${w} ${h} re`, "f");
}

function renderPage(
  page: DemoPdfPageV2,
  footnote: string,
  pageNumber: number,
  pageCount: number,
  watermark = true,
): string {
  const out: string[] = [];

  // Diagonal SAMPLE watermark, drawn first so all content sits above it.
  // Real client documents (watermark=false) skip it.
  if (watermark) {
    out.push(
      "BT",
      `/${FONTS.serifBold} 110 Tf`,
      `${WATERMARK} rg`,
      // 45° rotation: [cos sin -sin cos tx ty]
      "0.7071 0.7071 -0.7071 0.7071 130 170 Tm",
      `(${escapePdfText("SAMPLE")}) Tj`,
      "ET",
    );
  }

  if (page.border === "certificate") {
    // Double-rule border: gold outer, hairline inner.
    out.push(`${GOLD} RG`, "1.2 w", `36 36 ${PAGE_W - 72} ${PAGE_H - 72} re`, "S");
    out.push(`${HAIRLINE} RG`, "0.6 w", `42 42 ${PAGE_W - 84} ${PAGE_H - 84} re`, "S");
  }

  let y = CONTENT_TOP;
  for (const block of page.blocks) {
    switch (block.kind) {
      case "eyebrow":
        text(out, FONTS.sansBold, 8, GOLD, MARGIN, y, block.text.toUpperCase(), 1.4);
        y -= 22;
        break;
      case "title":
        text(out, FONTS.serifBold, 24, INK, MARGIN, y, block.text);
        y -= 18;
        break;
      case "rule":
        rect(out, GOLD, MARGIN, y + 2, 64, 2);
        y -= 22;
        break;
      case "meta": {
        for (const [label, value] of block.rows) {
          text(out, FONTS.sansBold, 7.5, MUTED, MARGIN, y, label.toUpperCase(), 1.1);
          text(out, FONTS.serif, 11, INK, MARGIN + 150, y - 1, value);
          y -= 20;
        }
        y -= 6;
        break;
      }
      case "heading":
        y -= 4;
        text(out, FONTS.serifBold, 12, INK, MARGIN, y, block.text);
        y -= 18;
        break;
      case "para":
        for (const line of block.lines) {
          text(out, FONTS.serif, 11, INK, MARGIN, y, line);
          y -= 16;
        }
        y -= 6;
        break;
      case "space":
        y -= block.pt ?? 12;
        break;
      case "signature":
        y -= 22;
        rect(out, INK, MARGIN, y, 210, 0.7);
        y -= 14;
        text(out, FONTS.serifBold, 11, INK, MARGIN, y, block.name);
        y -= 13;
        text(out, FONTS.sans, 9, MUTED, MARGIN, y, `${block.role} · ${block.date}`);
        y -= 16;
        break;
    }
  }

  // Fixed footer: hairline rule, REQUIRED sample watermark line, page number.
  rect(out, HAIRLINE, MARGIN, FOOTER_Y + 14, PAGE_W - MARGIN * 2, 0.6);
  text(out, FONTS.sansBold, 7, MUTED, MARGIN, FOOTER_Y, footnote.toUpperCase(), 0.8);
  text(
    out,
    FONTS.sans,
    7,
    MUTED,
    PAGE_W - MARGIN - 60,
    FOOTER_Y,
    `Page ${pageNumber} of ${pageCount}`,
  );

  return out.join("\n");
}

/** Assemble a multi-page document from rendered content streams. */
function assemblePdf(streams: string[]): Buffer {
  // Object layout: 1 catalog, 2 page tree, 3-6 fonts, then (page, content)
  // pairs — page i lives at object 7 + 2i, its stream at 8 + 2i.
  const kids = streams.map((_, index) => `${7 + index * 2} 0 R`).join(" ");
  const fontDict =
    "/Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >>";
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${streams.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
  ];
  streams.forEach((stream, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << ${fontDict} >> /Contents ${8 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/** Build a styled document from typed blocks. */
export function buildStyledDemoPdf(params: {
  pages: DemoPdfPageV2[];
  footnote: string;
  /** false = real client documents (no diagonal SAMPLE watermark). */
  watermark?: boolean;
}): Buffer {
  const pages = params.pages.length > 0 ? params.pages : [{ blocks: [] }];
  const streams = pages.map((page, index) =>
    renderPage(page, params.footnote, index + 1, pages.length, params.watermark !== false),
  );
  return assemblePdf(streams);
}

// ─── Legacy plain-text API (kept for compatibility; renders in the new
//     style: title block + body paragraphs) ─────────────────────────────────

export interface DemoPdfPage {
  title?: string;
  lines: string[];
}

export function buildDemoPdfPages(params: {
  pages: DemoPdfPage[];
  footnote: string;
}): Buffer {
  return buildStyledDemoPdf({
    footnote: params.footnote,
    pages: params.pages.map((page) => ({
      blocks: [
        ...(page.title
          ? ([{ kind: "title", text: page.title }, { kind: "rule" }] as DemoPdfBlock[])
          : []),
        { kind: "para", lines: page.lines },
      ],
    })),
  });
}

export function buildDemoPdf(params: {
  title: string;
  lines: string[];
  footnote: string;
}): Buffer {
  return buildDemoPdfPages({
    pages: [{ title: params.title, lines: params.lines }],
    footnote: params.footnote,
  });
}
