function utf16Hex(text: string) { return "FEFF" + Array.from(text).map(char => char.charCodeAt(0).toString(16).padStart(4, "0")).join(""); }
function escapePdfText(text: string) { return text.replace(/[\r\n]+/g, " ").slice(0, 1200); }

export function createChinesePdf(title: string, lines: string[]) {
  const safeLines = [title, ...lines].map(escapePdfText).slice(0, 28);
  const stream = safeLines.map((line, index) => `BT /F1 ${index === 0 ? 18 : 11} Tf 50 ${790 - index * 25} Td <${utf16Hex(line)}> Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>",
  ];
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(output); output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(o => `${String(o).padStart(10,"0")} 00000 n \n`).join("") + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
