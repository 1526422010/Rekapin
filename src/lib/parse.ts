export type ParsedTx = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  note: string;
  categoryHint?: string;
};

const AMOUNT = "(\\d{1,3}(?:\\.\\d{3})*|\\d+)";

/** Parse teks bebas: "+500000 gaji", "keluar 20.000 makan", "masuk 500000 gaji" */
export function parseTransaction(text: string): ParsedTx | null {
  const t = text.trim();

  // prefix: masuk/keluar/+ /-
  let m = t.match(
    new RegExp(`^(?:masuk|in|plus|\\+)\\s*${AMOUNT}(?:\\s+(.+))?$`, "i")
  );
  if (m) return { type: "INCOME", amount: num(m[1]), note: m[2] ?? "" };

  m = t.match(
    new RegExp(`^(?:keluar|out|minus|\\-)\\s*${AMOUNT}(?:\\s+(.+))?$`, "i")
  );
  if (m) return { type: "EXPENSE", amount: num(m[1]), note: m[2] ?? "" };

  // angka dulu baru prefix (contoh "500000 masuk gaji")
  m = t.match(
    new RegExp(`^${AMOUNT}\\s+(?:masuk|in|\\+)\\s*(.+)?$`, "i")
  );
  if (m) return { type: "INCOME", amount: num(m[1]), note: m[2] ?? "" };

  m = t.match(
    new RegExp(`^${AMOUNT}\\s+(?:keluar|out|\\-)\\s*(.+)?$`, "i")
  );
  if (m) return { type: "EXPENSE", amount: num(m[1]), note: m[2] ?? "" };

  return null;
}

/** Parse angka: 500000 / 20.000 / 1.5jt / 2jt500 */
function num(s: string): number {
  const cleaned = s.replace(/\./g, "");
  if (cleaned.includes(",")) return Math.round(parseFloat(cleaned.replace(",", ".")));
  return parseInt(cleaned, 10) || 0;
}

/** Ambil hint kategori dari note: kata pertama yang bukan angka/umum */
export function categoryHintFromNote(note: string): string | undefined {
  const first = note.trim().split(/\s+/)[0];
  if (!first) return undefined;
  if (/^[\d.,]+$/.test(first)) return undefined;
  return first.toLowerCase();
}
