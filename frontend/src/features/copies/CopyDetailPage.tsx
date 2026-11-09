import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  BookMarked,
  BookOpen,
  Calendar,
  Camera,
  HandCoins,
  MapPin,
  Pencil,
  PackageCheck,
  Plus,
  Receipt,
  Ruler,
  ScanLine,
  ShieldCheck,
  Tag,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { getCopyByCode, listPhotos, moveCopy, uploadPhoto } from "./api";
import { listCollections } from "../collections/api";
import { AddCopyModal } from "./AddCopyModal";
import { EditCopyModal } from "./EditCopyModal";
import { EditEditionModal } from "./EditEditionModal";
import { ConditionReportModal } from "./ConditionReportModal";
import { ValuationModal } from "./ValuationModal";
import { AcquisitionModal } from "./AcquisitionModal";
import { LocationModal } from "./LocationModal";
import { HistoryPanel } from "./HistoryPanel";
import { PhotoGallery } from "./PhotoGallery";
import { BookContentTab } from "./BookContentTab";
import { SummaryTab } from "./SummaryTab";
import { DocumentScanner } from "../scanner/DocumentScanner";
import { PerspectiveCropper } from "../scanner/PerspectiveCropper";
import { GRADE_LABEL, CONDITION_LABEL, ACQUISITION_METHOD_LABEL, COMPLETENESS_LABEL } from "./labels";

/**
 * Detail SATU eksemplar. Diakses lewat /copies/:collectionCode/:inventoryCode
 * (slug pendek, bukan UUID). Ini satu-satunya tempat untuk "Tambah Eksemplar
 * Lain untuk Buku Ini" — menambah eksemplar baru yang ditautkan ke EDISI
 * yang sama persis (kasus duplikat fisik dari buku yang sama), tanpa perlu
 * cari dari dropdown semua buku seperti sebelumnya.
 */
export default function CopyDetailPage() {
  const { collectionCode, inventoryCode } = useParams<{ collectionCode: string; inventoryCode: string }>();
  const [addingDuplicate, setAddingDuplicate] = useState(false);
  const [editingCopy, setEditingCopy] = useState(false);
  const [editingEdition, setEditingEdition] = useState(false);
  const [addingCondition, setAddingCondition] = useState(false);
  const [addingValuation, setAddingValuation] = useState(false);
  const [editingAcquisition, setEditingAcquisition] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [coverLightboxOpen, setCoverLightboxOpen] = useState(false);
  // coverPickerMode: "closed" | "choose" (pilih kamera/unggah) | "camera" | "cropping" (unggah berkas, sesuaikan crop)
  const [coverPickerMode, setCoverPickerMode] = useState<"closed" | "choose" | "camera" | "cropping">("closed");
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"isibuku" | "ringkasan" | "detail" | "foto" | "lainnya">("detail");
  const [movingCollection, setMovingCollection] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: copy, isLoading, error } = useQuery({
    queryKey: ["copy", collectionCode, inventoryCode],
    queryFn: () => getCopyByCode(collectionCode!, inventoryCode!),
    enabled: !!collectionCode && !!inventoryCode,
  });
  const { data: collections } = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const { data: photos } = useQuery({
    queryKey: ["photos", copy?.id],
    queryFn: () => listPhotos(copy!.id),
    enabled: !!copy,
  });
  const coverPhoto = photos?.find((p) => p.media_type === "cover_front") ?? photos?.[0];

  const moveMutation = useMutation({
    mutationFn: (targetCollectionId: string) => moveCopy(copy!.id, targetCollectionId),
    onSuccess: () => {
      toast.success("Eksemplar dipindahkan");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setMovingCollection(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memindahkan eksemplar");
    },
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File | Blob) =>
      uploadPhoto(
        copy!.id,
        file instanceof File ? file : new File([file], "cover.png", { type: "image/png" }),
        "cover_front",
        ""
      ),
    onSuccess: () => {
      toast.success("Foto sampul disimpan");
      queryClient.invalidateQueries({ queryKey: ["photos", copy?.id] });
      setCoverPickerMode("closed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto sampul");
    },
  });

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Memuat eksemplar...</p>;
  if (error || !copy) {
    return (
      <p className="text-sm text-red-700">
        Gagal memuat eksemplar: {error instanceof Error ? error.message : "tidak ditemukan"}
      </p>
    );
  }

  const ocrPct = copy.ocr_avg_confidence != null ? Math.round(copy.ocr_avg_confidence * 100) : null;
  const currentCollection = collections?.find((c) => c.id === copy.collection_id);
  const hasPhysicalDetail = Boolean(
    copy.completeness_status ||
      copy.dust_jacket_present ||
      copy.slipcase_present ||
      copy.height_mm ||
      copy.width_mm ||
      copy.thickness_mm ||
      copy.weight_grams ||
      copy.cover_description ||
      copy.binding_description ||
      copy.private_notes
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <button
              type="button"
              onClick={() => (coverPhoto ? setCoverLightboxOpen(true) : setCoverPickerMode("choose"))}
              title={coverPhoto ? "Lihat sampul" : "Set foto sampul"}
              disabled={uploadCoverMutation.isPending}
              className="shrink-0 disabled:opacity-50"
            >
              {coverPhoto ? (
                <img
                  src={coverPhoto.url}
                  alt=""
                  className="h-28 w-20 rounded-lg border border-[var(--color-border)] object-cover shadow-sm transition hover:opacity-80"
                />
              ) : (
                <div
                  className={`grid h-28 w-20 place-items-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] ${
                    uploadCoverMutation.isPending ? "animate-pulse" : ""
                  }`}
                >
                  <BookOpen size={22} />
                </div>
              )}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPendingCoverFile(file);
                  setCoverPickerMode("cropping");
                }
                e.target.value = "";
              }}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[var(--color-accent)]">{copy.inventory_code}</p>
                {copy.collection_grade && (
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                    {GRADE_LABEL[copy.collection_grade] ?? copy.collection_grade}
                  </span>
                )}
              </div>
              <h1 className="mt-0.5 font-[family-name:var(--font-heading)] text-2xl font-semibold leading-tight text-[var(--color-ink)]">
                {copy.preferred_title}
              </h1>
              {copy.author_name && (
                <p className="mt-0.5 text-base text-[var(--color-ink-soft)]">{copy.author_name}</p>
              )}
              {currentCollection && (
                <Link
                  to={`/collections/${currentCollection.code.toLowerCase()}`}
                  className="mt-1 inline-block text-sm text-[var(--color-accent)] hover:underline"
                >
                  {currentCollection.name}
                </Link>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingEdition(true)}
                  className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
                >
                  <Tag size={11} className="text-[var(--color-accent)]" />
                  {copy.category_name ?? "Kategori belum diisi"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEdition(true)}
                  className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
                >
                  <BookMarked size={11} className="text-[var(--color-accent)]" />
                  {copy.work_type_name ?? "Jenis karya belum diisi"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <button
              type="button"
              onClick={() => setMovingCollection(true)}
              title="Pindah ke koleksi lain"
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <ArrowRightLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setEditingEdition(true)}
              title="Edit buku"
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <BookOpen size={15} />
            </button>
            <button
              type="button"
              onClick={() => setEditingCopy(true)}
              title="Edit eksemplar"
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <Pencil size={15} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <InfoPill
            icon={Calendar}
            value={
              copy.publication_year
                ? copy.first_publication_year && copy.first_publication_year !== copy.publication_year
                  ? `Cet. ${copy.publication_year} (asli ${copy.first_publication_year})`
                  : String(copy.publication_year)
                : "Tahun ?"
            }
          />
          <button type="button" onClick={() => setEditingLocation(true)} className="text-left">
            <InfoPill icon={MapPin} value={copy.location_name ?? "Belum ada lokasi"} clickable />
          </button>
          <InfoPill
            icon={PackageCheck}
            value={
              copy.total_pages
                ? `${copy.page_count}/${copy.total_pages} hlm. discan`
                : `${copy.page_count} halaman discan`
            }
          />
          <InfoPill icon={ScanLine} value={ocrPct !== null ? `OCR ${ocrPct}%` : "Belum ada OCR"} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(
          [
            ["detail", "Detail"],
            ["isibuku", "Isi Buku"],
            ["ringkasan", "Ringkasan"],
            ["foto", "Foto"],
            ["lainnya", "Eksemplar Lainnya"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === key
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "isibuku" && <BookContentTab copyId={copy.id} totalPages={copy.total_pages} />}

      {activeTab === "ringkasan" && <SummaryTab copy={copy} />}

      {activeTab === "detail" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={ShieldCheck}
                label="Kondisi"
                value={copy.condition_grade ? (CONDITION_LABEL[copy.condition_grade] ?? copy.condition_grade) : "Belum dinilai"}
                onClick={() => setAddingCondition(true)}
              />
              <StatCard
                icon={TrendingUp}
                label="Estimasi"
                value={
                  copy.valuation_mid != null
                    ? `${copy.valuation_currency ?? ""} ${copy.valuation_mid.toLocaleString("id-ID")}`
                    : "Belum dinilai"
                }
                onClick={() => setAddingValuation(true)}
              />
              <StatCard
                icon={Receipt}
                label="Harga beli"
                value={
                  copy.purchase_price != null
                    ? `${copy.purchase_currency ?? ""} ${copy.purchase_price.toLocaleString("id-ID")}`
                    : "Belum dicatat"
                }
                onClick={() => setEditingAcquisition(true)}
              />
              <StatCard
                icon={HandCoins}
                label="Cara didapat"
                value={
                  copy.acquisition_method
                    ? (ACQUISITION_METHOD_LABEL[copy.acquisition_method] ?? copy.acquisition_method)
                    : "Belum dicatat"
                }
                subValue={
                  copy.acquisition_date ? new Date(copy.acquisition_date).toLocaleDateString("id-ID") : undefined
                }
                onClick={() => setEditingAcquisition(true)}
              />
            </div>
          </div>

          {hasPhysicalDetail && (
            <button
              type="button"
              onClick={() => setEditingCopy(true)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left hover:bg-[var(--color-parchment-dim)]"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Ruler size={15} />
                </span>
                <p className="text-sm font-semibold text-[var(--color-ink)]">Detail fisik</p>
              </div>
              <p className="mt-2 text-sm text-[var(--color-ink)]">
                {[
                  copy.completeness_status && (COMPLETENESS_LABEL[copy.completeness_status] ?? copy.completeness_status),
                  copy.dust_jacket_present && "ada dust jacket",
                  copy.slipcase_present && "ada slipcase",
                  copy.height_mm && copy.width_mm && `${copy.height_mm}×${copy.width_mm}mm`,
                  copy.thickness_mm && `tebal ${copy.thickness_mm}mm`,
                  copy.weight_grams && `${copy.weight_grams}g`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
              {copy.cover_description && (
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Sampul: {copy.cover_description}</p>
              )}
              {copy.binding_description && (
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Penjilidan: {copy.binding_description}</p>
              )}
              {copy.private_notes && (
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Catatan: {copy.private_notes}</p>
              )}
            </button>
          )}

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <HistoryPanel copyId={copy.id} />
          </div>
        </div>
      )}

      {activeTab === "foto" && <PhotoGallery copyId={copy.id} />}

      {activeTab === "lainnya" && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
              Eksemplar Lain dari Buku Ini
            </h2>
            <button
              type="button"
              onClick={() => setAddingDuplicate(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <Plus size={14} /> Tambah Eksemplar Lain untuk Buku Ini
            </button>
          </div>

          {copy.other_copies.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Belum ada eksemplar lain yang tertaut ke buku ini.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {copy.other_copies.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/copies/${o.collection_code.toLowerCase()}/${o.inventory_code}`}
                    className="text-sm text-[var(--color-accent)] hover:underline"
                  >
                    {o.inventory_code}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {addingDuplicate && (
        <AddCopyModal
          fixedEdition={{ editionId: copy.edition_id, title: copy.preferred_title }}
          onClose={() => setAddingDuplicate(false)}
        />
      )}
      {editingCopy && <EditCopyModal copy={copy} onClose={() => setEditingCopy(false)} />}
      {editingEdition && <EditEditionModal copy={copy} onClose={() => setEditingEdition(false)} />}
      {addingCondition && (
        <ConditionReportModal
          copyId={copy.id}
          defaultGrade={copy.condition_grade}
          onClose={() => setAddingCondition(false)}
        />
      )}
      {addingValuation && (
        <ValuationModal
          copyId={copy.id}
          defaultCurrency={copy.valuation_currency ?? currentCollection?.default_currency}
          defaultValues={{
            valuation_type: copy.valuation_type,
            valuation_low: copy.valuation_low,
            valuation_mid: copy.valuation_mid,
            valuation_high: copy.valuation_high,
            valuation_basis: copy.valuation_basis,
          }}
          onClose={() => setAddingValuation(false)}
        />
      )}
      {editingAcquisition && (
        <AcquisitionModal
          copyId={copy.id}
          defaultValues={{
            acquisition_method: copy.acquisition_method,
            acquisition_date: copy.acquisition_date,
            purchase_price: copy.purchase_price,
            purchase_currency: copy.purchase_currency,
            acquisition_seller_name: copy.acquisition_seller_name,
          }}
          onClose={() => setEditingAcquisition(false)}
        />
      )}
      {editingLocation && (
        <LocationModal
          copyId={copy.id}
          collectionId={copy.collection_id}
          currentLocationId={copy.current_location_id}
          onClose={() => setEditingLocation(false)}
        />
      )}
      {movingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setMovingCollection(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-sm space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Pindah ke Koleksi Lain
              </h3>
              <button
                type="button"
                onClick={() => setMovingCollection(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {collections
                ?.filter((c) => c.id !== copy.collection_id)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={moveMutation.isPending}
                    onClick={() => moveMutation.mutate(c.id)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-parchment-dim)] disabled:opacity-50"
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
      {coverLightboxOpen && coverPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setCoverLightboxOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={coverPhoto.url}
              alt={copy.preferred_title}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setCoverLightboxOpen(false)}
              aria-label="Tutup"
              className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-[var(--color-ink)] shadow-lg hover:bg-[var(--color-parchment-dim)]"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCoverLightboxOpen(false);
                setCoverPickerMode("choose");
              }}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-white/95 px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] shadow-lg hover:bg-white"
            >
              <Pencil size={13} /> Ganti Foto
            </button>
          </div>
        </div>
      )}
      {coverPickerMode === "choose" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setCoverPickerMode("closed")}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-sm space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Set Foto Sampul
              </h3>
              <button
                type="button"
                onClick={() => setCoverPickerMode("closed")}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCoverPickerMode("camera")}
              className="flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <Camera size={16} /> Foto dengan Kamera
            </button>
            <button
              type="button"
              onClick={() => {
                setCoverPickerMode("closed");
                coverInputRef.current?.click();
              }}
              className="flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <Upload size={16} /> Unggah Berkas
            </button>
          </div>
        </div>
      )}
      {coverPickerMode === "camera" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setCoverPickerMode("closed")}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Foto Sampul dari Kamera
              </h3>
              <button
                type="button"
                onClick={() => setCoverPickerMode("closed")}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <DocumentScanner
              onCapture={(blob) => uploadCoverMutation.mutate(blob)}
              processing={uploadCoverMutation.isPending}
              confirmLabel="Gunakan Foto Ini"
              onCancel={() => setCoverPickerMode("closed")}
            />
          </div>
        </div>
      )}
      {coverPickerMode === "cropping" && pendingCoverFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setCoverPickerMode("closed")}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Sesuaikan Crop Sampul
              </h3>
              <button
                type="button"
                onClick={() => setCoverPickerMode("closed")}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <PerspectiveCropper
              file={pendingCoverFile}
              onConfirm={(blob) => uploadCoverMutation.mutate(blob)}
              onCancel={() => setCoverPickerMode("closed")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  onClick,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  subValue?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--color-border)] p-3 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-parchment-dim)]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Icon size={15} />
      </span>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{label}</p>
      <p className="truncate font-semibold text-[var(--color-ink)]">
        {value}
        {subValue && <span className="ml-1 text-sm font-normal text-[var(--color-ink-muted)]">({subValue})</span>}
      </p>
    </button>
  );
}

function InfoPill({
  icon: Icon,
  value,
  clickable,
}: {
  icon: typeof Calendar;
  value: string;
  clickable?: boolean;
}) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2.5 py-2 text-[var(--color-ink-soft)] ${
        clickable ? "hover:bg-[var(--color-parchment-dim)]" : ""
      }`}
    >
      <Icon size={16} className="shrink-0 text-[var(--color-accent)]" />
      <span className="truncate">{value}</span>
    </span>
  );
}
