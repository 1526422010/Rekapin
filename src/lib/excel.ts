import ExcelJS from "exceljs";
import type { Transaction, Category } from "@/generated/prisma/client";
import { formatIDR } from "@/lib/utils";

type Tx = Transaction & { category: Category };

const rupiah = (n: number) => `Rp ${formatIDR(n)}`;

export async function buildWorkbook(txs: Tx[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rekapin";

  const income = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  // ---- Sheet 1: Ringkasan ----
  const s1 = wb.addWorksheet("Ringkasan");
  s1.columns = [{ width: 28 }, { width: 18 }];
  const title = s1.getCell("A1");
  title.value = "Ringkasan Keuangan";
  title.font = { bold: true, size: 14 };
  s1.mergeCells("A1:B1");
  s1.getCell("A3").value = "Periode";
  s1.getCell("B3").value = "Bulan Berjalan";
  s1.getCell("A4").value = "Total Pemasukan";
  s1.getCell("B4").value = rupiah(income);
  s1.getCell("A5").value = "Total Pengeluaran";
  s1.getCell("B5").value = rupiah(expense);
  s1.getCell("A6").value = "Selisih";
  s1.getCell("B6").value = rupiah(income - expense);
  for (const row of [3, 4, 5, 6]) {
    s1.getCell(`A${row}`).font = { bold: true };
  }
  s1.getCell("B6").font = { bold: true };

  // ---- Sheet 2: Detail ----
  const s2 = wb.addWorksheet("Detail Transaksi");
  s2.columns = [
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Kategori", key: "category", width: 22 },
    { header: "Keterangan", key: "note", width: 32 },
    { header: "Nominal", key: "amount", width: 18 },
    { header: "Tipe", key: "type", width: 12 },
  ];
  s2.getRow(1).font = { bold: true };
  s2.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

  for (const t of txs) {
    s2.addRow({
      date: t.date.toISOString().slice(0, 10),
      category: t.category.name,
      note: t.note ?? "-",
      amount: rupiah(t.amount),
      type: t.type === "INCOME" ? "Masuk" : "Keluar",
    });
  }
  s2.autoFilter = { from: "A1", to: "E1" };

  return wb;
}
