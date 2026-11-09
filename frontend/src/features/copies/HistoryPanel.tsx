import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ClipboardList, Coins, Plus, Users } from "lucide-react";
import { addProvenance, listConditionReports, listProvenance, listValuations } from "./api";
import { CONDITION_LABEL, VALUATION_TYPE_LABEL } from "./labels";

const PROVENANCE_EVENT_LABEL: Record<string, string> = {
  created: "Dibuat",
  owned: "Dimiliki",
  gifted: "Dihadiahkan",
  inherited: "Diwariskan",
  purchased: "Dibeli",
  sold: "Dijual",
  auctioned: "Dilelang",
  transferred: "Ditransfer",
  unknown: "Tidak diketahui",
};

/** Riwayat laporan kondisi, valuasi, & kepemilikan (provenance) lengkap —
 * beda dari kartu "Kondisi"/"Estimasi" di atas yang cuma menunjukkan
 * laporan/valuasi TERBARU. Prinsip "riwayat tidak ditimpa" (README.md) baru
 * terasa gunanya kalau riwayatnya bisa dilihat lagi, bukan cuma tersimpan
 * diam-diam di database. */
export function HistoryPanel({ copyId }: { copyId: string }) {
  const [openConditions, setOpenConditions] = useState(false);
  const [openValuations, setOpenValuations] = useState(false);
  const [openProvenance, setOpenProvenance] = useState(false);
  const [addingProvenance, setAddingProvenance] = useState(false);
  const queryClient = useQueryClient();

  const { data: conditions } = useQuery({
    queryKey: ["condition-reports", copyId],
    queryFn: () => listConditionReports(copyId),
    enabled: openConditions,
  });
  const { data: valuations } = useQuery({
    queryKey: ["valuations", copyId],
    queryFn: () => listValuations(copyId),
    enabled: openValuations,
  });
  const { data: provenance } = useQuery({
    queryKey: ["provenance", copyId],
    queryFn: () => listProvenance(copyId),
    enabled: openProvenance,
  });

  const [eventType, setEventType] = useState("purchased");
  const [ownerName, setOwnerName] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [periodText, setPeriodText] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");

  const addProvenanceMutation = useMutation({
    mutationFn: () =>
      addProvenance(copyId, {
        event_type: eventType,
        owner_name: ownerName,
        counterparty_name: counterpartyName,
        period_text: periodText,
        period_start_year: null,
        period_end_year: null,
        evidence_summary: evidenceSummary,
        verification_status: "",
        confidence: "",
      }),
    onSuccess: () => {
      toast.success("Riwayat kepemilikan ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["provenance", copyId] });
      setAddingProvenance(false);
      setOwnerName("");
      setCounterpartyName("");
      setPeriodText("");
      setEvidenceSummary("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan riwayat kepemilikan");
    },
  });

  return (
    <div className="divide-y divide-[var(--color-border)]">
      <HistorySection
        icon={ClipboardList}
        title="Riwayat Kondisi"
        count={conditions?.length}
        open={openConditions}
        onToggle={() => setOpenConditions((v) => !v)}
      >
        {conditions === undefined ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Memuat...</p>
        ) : conditions.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Belum ada laporan kondisi.</p>
        ) : (
          <ul className="space-y-2">
            {conditions.map((c) => (
              <li key={c.id} className="rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--color-ink)]">
                    {c.condition_grade ? (CONDITION_LABEL[c.condition_grade] ?? c.condition_grade) : "Tanpa grade"}
                    {c.condition_score != null && (
                      <span className="ml-1 text-sm text-[var(--color-ink-muted)]">({c.condition_score})</span>
                    )}
                  </span>
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    {new Date(c.report_date).toLocaleDateString("id-ID")}
                  </span>
                </div>
                {c.note && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{c.note}</p>}
                {(c.foxing || c.mold_present || c.pest_damage_present || c.water_damage || c.active_risk) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.foxing && <Tag>Foxing</Tag>}
                    {c.mold_present && <Tag>Jamur</Tag>}
                    {c.pest_damage_present && <Tag>Serangga</Tag>}
                    {c.water_damage && <Tag>Bekas air</Tag>}
                    {c.active_risk && <Tag danger>Risiko aktif</Tag>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </HistorySection>

      <HistorySection
        icon={Coins}
        title="Riwayat Valuasi"
        count={valuations?.length}
        open={openValuations}
        onToggle={() => setOpenValuations((v) => !v)}
      >
        {valuations === undefined ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Memuat...</p>
        ) : valuations.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Belum ada valuasi.</p>
        ) : (
          <ul className="space-y-2">
            {valuations.map((v) => (
              <li key={v.id} className="rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--color-ink)]">
                    {v.valuation_type ? (VALUATION_TYPE_LABEL[v.valuation_type] ?? v.valuation_type) : "Tanpa jenis"}
                  </span>
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    {new Date(v.valuation_date).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                  {v.value_low != null && `${v.currency ?? ""} ${v.value_low.toLocaleString("id-ID")}`}
                  {v.value_mid != null && ` – ${v.currency ?? ""} ${v.value_mid.toLocaleString("id-ID")}`}
                  {v.value_high != null && ` – ${v.currency ?? ""} ${v.value_high.toLocaleString("id-ID")}`}
                </p>
                {v.valuation_basis && <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{v.valuation_basis}</p>}
              </li>
            ))}
          </ul>
        )}
      </HistorySection>

      <HistorySection
        icon={Users}
        title="Riwayat Kepemilikan"
        count={provenance?.length}
        open={openProvenance}
        onToggle={() => setOpenProvenance((v) => !v)}
      >
        {provenance === undefined ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Memuat...</p>
        ) : (
          <>
            {provenance.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">Belum ada riwayat kepemilikan.</p>
            ) : (
              <ul className="space-y-2">
                {provenance.map((p) => (
                  <li key={p.id} className="rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-ink)]">
                        {p.event_type ? (PROVENANCE_EVENT_LABEL[p.event_type] ?? p.event_type) : "Tanpa jenis"}
                      </span>
                      {p.period_text && (
                        <span className="text-sm text-[var(--color-ink-muted)]">{p.period_text}</span>
                      )}
                    </div>
                    {(p.owner_name || p.counterparty_name) && (
                      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                        {p.owner_name && `Pemilik: ${p.owner_name}`}
                        {p.owner_name && p.counterparty_name && " · "}
                        {p.counterparty_name && `Pihak lain: ${p.counterparty_name}`}
                      </p>
                    )}
                    {p.evidence_summary && (
                      <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{p.evidence_summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!addingProvenance ? (
              <button
                type="button"
                onClick={() => setAddingProvenance(true)}
                className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                <Plus size={12} /> Tambah riwayat kepemilikan
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addProvenanceMutation.mutate();
                }}
                className="mt-2 space-y-2 rounded-md border border-[var(--color-border)] p-2"
              >
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                >
                  {Object.entries(PROVENANCE_EVENT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nama pemilik"
                    className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                  />
                  <input
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                    placeholder="Pihak lain (opsional)"
                    className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                  />
                </div>
                <input
                  value={periodText}
                  onChange={(e) => setPeriodText(e.target.value)}
                  placeholder="Periode (mis. 2026)"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                />
                <textarea
                  value={evidenceSummary}
                  onChange={(e) => setEvidenceSummary(e.target.value)}
                  placeholder="Catatan/bukti (opsional)"
                  rows={2}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingProvenance(false)}
                    className="rounded-md border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-[var(--color-parchment-dim)]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={addProvenanceMutation.isPending}
                    className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {addProvenanceMutation.isPending ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </HistorySection>
    </div>
  );
}

function HistorySection({
  icon: Icon,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  icon: typeof ClipboardList;
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md py-1 text-left hover:bg-[var(--color-parchment-dim)]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Icon size={14} />
        </span>
        <span className="flex-1 text-sm font-semibold text-[var(--color-ink)]">{title}</span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
            {count}
          </span>
        )}
        <ChevronDown
          size={15}
          className={`shrink-0 text-[var(--color-ink-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="mt-2 pl-10">{children}</div>}
    </div>
  );
}

function Tag({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-sm font-medium ${
        danger
          ? "bg-red-100 text-red-700"
          : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
      }`}
    >
      {children}
    </span>
  );
}
