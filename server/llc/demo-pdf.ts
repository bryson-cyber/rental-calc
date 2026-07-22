/**
 * Minimal single-page PDF builder for demo formation documents.
 *
 * No dependencies: emits a valid PDF 1.4 file by hand — catalog, page tree,
 * one page, the built-in Helvetica font, a text content stream, an xref
 * table with correct byte offsets, and a trailer. Only used to fabricate
 * clearly-watermarked SAMPLE documents for webinar demo filings.
 */

/** Escape a string for a PDF literal string: backslashes and parentheses. */
function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Em dash is not latin1; StandardEncoding octal 0320 renders an emdash
    // with the built-in Helvetica font.
    .replace(/—/g, "\\320")
    // Anything else outside latin1 would corrupt the byte stream; degrade
    // gracefully to a space.
    .replace(/[^\x20-\x7e\\]/g, " ");
}

export function buildDemoPdf(params: {
  title: string;
  lines: string[];
  footnote: string;
}): Buffer {
  const content: string[] = ["BT", "/F1 18 Tf", "72 708 Td", `(${escapePdfText(params.title)}) Tj`, "/F1 11 Tf", "0 -40 Td"];
  for (const line of params.lines) {
    content.push(`(${escapePdfText(line)}) Tj`, "0 -18 Td");
  }
  // REQUIRED sample watermark line, smaller and separated from the body.
  content.push("/F1 8 Tf", "0 -36 Td", `(${escapePdfText(params.footnote)}) Tj`, "ET");
  const stream = content.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

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
