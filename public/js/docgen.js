// Παραγωγή του «Υπηρεσιακού Σημειώματος» υπερωριών (.docx) από πρότυπο με {{πεδία}}.
import { overtimeRows, greekWords, MONTHS_ACC } from "./logic.js";

let jszipLoading;
export function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(window[globalName]); s.onerror = () => rej(new Error("Δεν φορτώθηκε το " + src));
    document.head.appendChild(s);
  });
}
const JSZip = () => (jszipLoading ||= loadScript("/vendor/jszip.min.js", "JSZip"));

const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr>';
const cell = (text, w) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
  `<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>` +
  `<w:r>${RPR}<w:t xml:space="preserve">${x(text)}</w:t></w:r></w:p></w:tc>`;
const border = (v, sz) => `<w:${v} w:val="single" w:sz="${sz}" w:space="0" w:color="000000"/>`;

/** Πίνακας Word: κεφαλίδα + γραμμές (κεντραρισμένος, όπως στο Excel) */
function tableXml(head, rows) {
  const W = [1700, 2600, 900];
  const tr = (cells) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.map((c, i) => cell(c, W[i])).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:tblBorders>` +
    border("top", 12) + border("left", 12) + border("bottom", 12) + border("right", 12) + border("insideH", 4) + border("insideV", 4) +
    `</w:tblBorders><w:tblLayout w:type="autofit"/><w:tblLook w:val="0000"/></w:tblPr>` +
    `<w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
    tr(head) + rows.map((r) => tr([r.date, r.time, String(r.hours)])).join("") + `</w:tbl>`;
}

async function templateBytes(template) {
  if (template?.b64) return Uint8Array.from(atob(template.b64), (c) => c.charCodeAt(0));
  const res = await fetch("/templates/ypereories.docx");
  if (!res.ok) throw new Error("Δεν βρέθηκε το πρότυπο");
  return new Uint8Array(await res.arrayBuffer());
}

/** Φτιάχνει το .docx για τον μήνα και επιστρέφει { blob, name, rows } */
export async function buildOvertimeDoc({ days, settings, template }, y, m) {
  const rows = overtimeRows(days, y, m, settings);
  const Zip = await JSZip();
  const zip = await Zip.loadAsync(await templateBytes(template));
  let doc = await zip.file("word/document.xml").async("string");
  const values = {
    curMonth: MONTHS_ACC[m - 1], curYear: String(y),
    NumHours: String(rows.totalWork), WordHours: greekWords(rows.totalWork),
    NumHoursArgia: String(rows.totalHol), WordHoursArgia: greekWords(rows.totalHol),
  };
  for (const [k, v] of Object.entries(values)) doc = doc.split(`{{${k}}}`).join(x(v));
  // Οι πίνακες αντικαθιστούν ολόκληρη την παράγραφο που έχει το {{tblHours}} / {{tblHoursArgia}}
  const tables = {
    tblHours: rows.work.length ? tableXml(["ΗΜΕΡΟΜΗΝΙΑ", "ΩΡΑΡΙΟ ΚΑΘΗΜΕΡΙΝΗΣ", "ΩΡΕΣ"], rows.work) : "",
    tblHoursArgia: rows.hol.length ? tableXml(["ΗΜΕΡΟΜΗΝΙΑ", "ΩΡΑΡΙΟ ΑΡΓΙΑΣ", "ΩΡΕΣ"], rows.hol) : "",
  };
  for (const [k, t] of Object.entries(tables)) {
    const re = new RegExp(`<w:p\\b(?:(?!<w:p\\b).)*?\\{\\{${k}\\}\\}.*?</w:p>`, "s");
    doc = doc.replace(re, t ? t + "<w:p/>" : "<w:p/>");
  }
  const left = doc.match(/\{\{\w+\}\}/g);
  if (left) console.warn("Πεδία χωρίς τιμή στο πρότυπο:", left);
  zip.file("word/document.xml", doc);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  return { blob, name: `Υπερωρίες ${MONTHS_ACC[m - 1]} ${y}.docx`, rows };
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
