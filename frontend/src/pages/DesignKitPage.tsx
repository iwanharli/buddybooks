import { useState } from "react";
import { toast } from "sonner";
import { BookMarked, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Carousel } from "../components/ui/Carousel";
import { TablePagination, usePagination } from "../components/ui/TablePagination";

const acquisitionSchema = z.object({
  inventoryCode: z.string().min(1, "Wajib diisi"),
  purchasePrice: z.coerce.number().min(0, "Tidak boleh negatif"),
});
type AcquisitionFormInput = z.input<typeof acquisitionSchema>;
type AcquisitionFormOutput = z.output<typeof acquisitionSchema>;

interface GradeRow {
  grade: string;
  count: number;
}

const gradeData: GradeRow[] = [
  { grade: "Inti", count: 12 },
  { grade: "Penting", count: 8 },
  { grade: "Pendukung", count: 20 },
  { grade: "Bacaan", count: 15 },
  { grade: "Duplikat", count: 5 },
];

const gradeColumns: ColumnDef<GradeRow>[] = [
  { accessorKey: "grade", header: "Kelas" },
  { accessorKey: "count", header: "Jumlah" },
];

export default function DesignKitPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [sorting, setSorting] = useState<SortingState>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcquisitionFormInput, unknown, AcquisitionFormOutput>({
    resolver: zodResolver(acquisitionSchema),
  });

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: { "image/*": [] },
  });

  const table = useReactTable({
    data: gradeData,
    columns: gradeColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const tableRows = table.getRowModel().rows;
  const pagination = usePagination(tableRows, {
    initialPageSize: 3,
    resetKey: JSON.stringify(sorting),
  });

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h2 className="text-lg">Tipografi</h2>
        <p className="font-[family-name:var(--font-heading)] text-2xl">
          Fraunces — untuk judul, kesan naskah tua
        </p>
        <p className="font-[family-name:var(--font-body)]">
          Inter — untuk isi teks, mudah dibaca di layar
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Ikon</h2>
        <div className="flex gap-4 text-[var(--color-accent)]">
          <BookMarked /> <Sparkles /> <Trash2 />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Animasi</h2>
        <motion.div
          className="h-16 w-16 rounded-lg bg-[var(--color-accent)]"
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Modal & Konfirmasi</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Buka Modal
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="rounded-md border border-red-700 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Hapus (konfirmasi)
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Notifikasi</h2>
        <button
          onClick={() => toast.success("Eksemplar berhasil disimpan")}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)]"
        >
          Tampilkan Notifikasi
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Karusel</h2>
        <Carousel>
          {["Sejarah", "Sastra", "Peta", "Agama", "Biografi"].map((cat) => (
            <div
              key={cat}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-accent-soft)] p-6 text-center"
            >
              {cat}
            </div>
          ))}
        </Carousel>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Kode QR</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Contoh QR untuk eksemplar BK-IND-000001, menunjuk ke ID internal permanen.
        </p>
        <QRCodeSVG value="https://buddybooks.local/copies/00000000-0000-0000-0000-000000000001" size={120} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Pemilih Tanggal</h2>
        <DayPicker mode="single" selected={date} onSelect={setDate} />
        <p className="text-sm text-[var(--color-ink-soft)]">
          Terpilih: {date ? date.toLocaleDateString("id-ID") : "belum ada"}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Formulir</h2>
        <form
          onSubmit={handleSubmit((data) => toast.success(`Tersimpan: ${data.inventoryCode}`))}
          className="space-y-3"
        >
          <div>
            <input
              {...register("inventoryCode")}
              placeholder="Kode inventaris"
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            {errors.inventoryCode && (
              <p className="text-xs text-red-700">{errors.inventoryCode.message}</p>
            )}
          </div>
          <div>
            <input
              type="number"
              step="0.01"
              {...register("purchasePrice")}
              placeholder="Harga beli"
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            {errors.purchasePrice && (
              <p className="text-xs text-red-700">{errors.purchasePrice.message}</p>
            )}
          </div>
          <button
            type="submit"
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Simpan
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Unggah Foto</h2>
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm ${
            isDragActive ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]" : "border-[var(--color-border)]"
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="text-[var(--color-ink-soft)]" />
          <p>Seret foto ke sini, atau klik untuk memilih</p>
        </div>
        {acceptedFiles.length > 0 && (
          <ul className="text-xs text-[var(--color-ink-soft)]">
            {acceptedFiles.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Tabel</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--color-surface)]">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className="cursor-pointer border-b border-[var(--color-border)] p-3 text-left font-medium text-[var(--color-ink-soft)]"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {pagination.pageItems.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--color-surface)]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="border-b border-[var(--color-border)] p-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageSizeOptions={[3, 5, 10]}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Grafik</h2>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={gradeData}>
              <XAxis dataKey="grade" stroke="var(--color-ink-soft)" fontSize={12} />
              <YAxis stroke="var(--color-ink-soft)" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Contoh Modal"
        description="Ini contoh isi modal untuk detail eksemplar."
      >
        <p className="text-sm text-[var(--color-ink-soft)]">
          Konten modal bisa diisi form, detail buku, atau apa pun.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus eksemplar ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        destructive
        confirmLabel="Ya, hapus"
        onConfirm={() => toast.error("Eksemplar dihapus (contoh)")}
      />
    </div>
  );
}
