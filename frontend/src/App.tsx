import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import {
  Archive,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Bug,
  Calendar,
  Camera,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Database,
  ExternalLink,
  Eye,
  FileText,
  LayoutDashboard,
  LibraryBig,
  LockKeyhole,
  MapPin,
  Menu,
  PackageSearch,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
  Users,
  X,
} from "lucide-react";
import CollectionsListPage from "./features/collections/CollectionsListPage";
import CollectionDetailPage from "./features/collections/CollectionDetailPage";
import CopyDetailPage from "./features/copies/CopyDetailPage";
import { TablePagination, usePagination } from "./components/ui/TablePagination";
import { getMasterDetail, listMasterItems, type MasterDetail } from "./features/master/api";
import DesignKitPage from "./pages/DesignKitPage";
import ReaderDemoPage from "./pages/ReaderDemoPage";
import ScannerDemoPage from "./pages/ScannerDemoPage";
import ScanSessionPage from "./pages/ScanSessionPage";

const appNavItems = [
  { to: "/dashboard", label: "Dasbor", icon: LayoutDashboard },
  { to: "/collections", label: "Koleksi", icon: LibraryBig },
];

const debugNavItems = [
  { to: "/scan-session", label: "Sesi Pemindaian", icon: ScanLine },
  { to: "/reader-demo", label: "Pembaca", icon: BookOpenCheck },
  { to: "/scanner-demo", label: "Pemindai", icon: Camera },
  { to: "/design-kit", label: "Panduan Desain", icon: Sparkles },
];

const masterNavItems = [
  { to: "/master/agents", resource: "agents", label: "Pelaku", icon: Users, description: "Penulis, editor, penerjemah, ilustrator, dan kontributor buku." },
  { to: "/master/publishers", resource: "publishers", label: "Penerbit", icon: BookOpenCheck, description: "Penerbit dan percetakan buku untuk katalog edisi." },
  { to: "/master/places", resource: "places", label: "Tempat", icon: MapPin, description: "Kota, negara, wilayah, tempat terbit dan transaksi." },
  { to: "/master/categories", resource: "categories", label: "Kategori", icon: Archive, description: "Kategori/subjek karya dalam struktur hierarki." },
  { to: "/master/work-types", resource: "work-types", label: "Jenis Karya", icon: LibraryBig, description: "Jenis benda: buku, peta, manuskrip, foto, poster." },
  { to: "/master/languages", resource: "languages", label: "Bahasa", icon: BookOpenCheck, description: "Bahasa dan kode ISO untuk karya, edisi, dan halaman." },
  { to: "/master/storage-locations", resource: "storage-locations", label: "Lokasi Simpan", icon: Boxes, description: "Ruang, lemari, rak, kotak, brankas, dan lokasi fisik." },
  { to: "/master/shipping-carriers", resource: "shipping-carriers", label: "Kurir", icon: PackageSearch, description: "Kurir dan jasa pengiriman kanal jual." },
  { to: "/master/payment-methods", resource: "payment-methods", label: "Metode Pembayaran", icon: QrCode, description: "Metode pembayaran untuk akuisisi dan transaksi." },
  { to: "/master/sales-channels", resource: "sales-channels", label: "Kanal Penjualan", icon: TrendingUp, description: "Kanal beli/jual: lokapasar, lelang, langsung, sosial." },
];

// Judul generik di header berdasarkan rute aktif — sebelumnya di sini
// hardcode "Koleksi Sejarah Indonesia" di SEMUA halaman (termasuk Dasbor,
// Sesi Pemindaian, dst), padahal itu cuma relevan saat benar-benar sedang
// membuka satu koleksi. Nama koleksi asli (dari mockCollections) ditampilkan
// sendiri oleh CollectionDetailPage, bukan di sini.
function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/master/")) {
    return masterNavItems.find((item) => item.to === pathname)?.label ?? "Data Master";
  }
  if (pathname.startsWith("/collections/")) return "Koleksi";
  const flat = [...appNavItems, ...debugNavItems];
  return flat.find((item) => item.to === pathname)?.label ?? "Buddybooks";
}

const metrics = [
  { label: "Total Buku", value: "1.284", change: "+42 bulan ini", icon: Boxes },
  { label: "Potensi Penjualan", value: "Rp 3,8 M", change: "+12,4%", icon: TrendingUp },
  { label: "Perlu Dicek", value: "37", change: "9 stok menipis", icon: ClipboardCheck },
  { label: "Pesanan Diproses", value: "128", change: "18 hari ini", icon: FileText },
];

const workflowItems = [
  { title: "Katalog siap jual", detail: "Kelola judul, penulis, penerbit, kategori, foto sampul, harga, dan stok.", icon: Database },
  { title: "Etalase marketplace", detail: "Tampilkan buku baru, bekas, akademik, anak, koleksi, dan edisi khusus dalam katalog publik.", icon: LibraryBig },
  { title: "Harga & transaksi", detail: "Pantau harga, diskon, metode pembayaran, kanal penjualan, dan riwayat pesanan.", icon: BarChart3 },
  { title: "Operasional toko", detail: "Atur kondisi buku, lokasi stok, kurir, status ketersediaan, dan catatan internal.", icon: ShieldCheck },
];

const featuredBooks = [
  {
    code: "BK-FIC-0001",
    title: "Novel Pilihan Minggu Ini",
    author: "Tim Kurasi Buddybooks",
    year: "2026",
    publisher: "Berbagai Penerbit",
    category: "Fiksi",
    condition: "Baru",
    location: "Siap kirim",
    price: "Rp 89.000",
    stock: "24 stok",
    coverTone: "from-sky-900 via-blue-700 to-cyan-500",
  },
  {
    code: "BK-BIZ-0142",
    title: "Strategi Bisnis Praktis",
    author: "Editor Marketplace",
    year: "2025",
    publisher: "Penerbit Nusantara",
    category: "Bisnis",
    condition: "Baru",
    location: "Gudang utama",
    price: "Rp 126.000",
    stock: "18 stok",
    coverTone: "from-indigo-900 via-sky-700 to-emerald-400",
  },
  {
    code: "BK-EDU-0238",
    title: "Matematika SMA Ringkas",
    author: "Tim Akademik",
    year: "2024",
    publisher: "Cendekia Press",
    category: "Pendidikan",
    condition: "Baru",
    location: "Siap kirim",
    price: "Rp 74.500",
    stock: "41 stok",
    coverTone: "from-slate-900 via-blue-800 to-teal-500",
  },
  {
    code: "BK-KID-0107",
    title: "Cerita Anak Nusantara",
    author: "Kolektif Penulis",
    year: "2025",
    publisher: "Pelangi Anak",
    category: "Anak",
    condition: "Baru",
    location: "Siap kirim",
    price: "Rp 58.000",
    stock: "32 stok",
    coverTone: "from-blue-950 via-sky-700 to-amber-300",
  },
  {
    code: "BK-USE-0319",
    title: "Paket Buku Bekas Berkualitas",
    author: "Seller Terverifikasi",
    year: "Campuran",
    publisher: "Berbagai Penerbit",
    category: "Bekas",
    condition: "Layak Baca",
    location: "Stok terbatas",
    price: "Mulai Rp 35.000",
    stock: "12 stok",
    coverTone: "from-cyan-900 via-blue-600 to-lime-400",
  },
  {
    code: "BK-RARE-0048",
    title: "Edisi Koleksi dan Langka",
    author: "Kurator Buku",
    year: "Koleksi",
    publisher: "Kurasi Buddybooks",
    category: "Koleksi",
    condition: "Terkurasi",
    location: "By request",
    price: "Hubungi seller",
    stock: "3 stok",
    coverTone: "from-zinc-900 via-slate-700 to-sky-500",
  },
];

const publicCategoryFilters = ["Semua", "Fiksi", "Bisnis", "Pendidikan", "Anak", "Bekas", "Koleksi"];

const dashboardRows = [
  ["BK-IND-0001", "Di Bawah Bendera Revolusi", "Inti", "Baik", "Rak A-02"],
  ["BK-MAP-0048", "Kaart van Java", "Penting", "Cukup", "Brankas V1"],
  ["BK-LIT-0214", "Sitti Nurbaya", "Bacaan", "Sangat baik", "Lemari C1"],
  ["BK-DOC-0091", "Surat Kabar Merdeka", "Pendukung", "Buruk", "Kotak 04"],
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[var(--color-ink)]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/70 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <LibraryBig size={20} />
            </span>
            <span className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-normal">
              Buddybooks
            </span>
          </NavLink>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--color-ink-soft)] md:flex">
            <a href="#features" className="hover:text-[var(--color-accent)]">Fitur</a>
            <NavLink to="/catalog" className="hover:text-[var(--color-accent)]">Katalog</NavLink>
            <a href="#workflow" className="hover:text-[var(--color-accent)]">Alur</a>
            <a href="#reader" className="hover:text-[var(--color-accent)]">Etalase</a>
            <NavLink to="/dashboard" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-white shadow-sm shadow-blue-900/10">
              Masuk Dasbor
            </NavLink>
          </nav>
          <NavLink
            to="/dashboard"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)] md:hidden"
            aria-label="Buka dasbor"
          >
            <Menu size={18} />
          </NavLink>
        </div>
      </header>

      <main>
        <section className="relative isolate min-h-[88vh] overflow-hidden pt-24">
          <img
            src="/landing-hero.png"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-white/62" />
          <div className="absolute inset-y-0 left-0 -z-10 hidden w-[62%] bg-white/76 sm:block" />
          <div className="mx-auto flex min-h-[calc(88vh-6rem)] max-w-7xl items-center px-5 pb-12 pt-16 lg:px-8">
            <div className="hero-copy min-w-0">
              <p className="mb-5 inline-flex max-w-full items-center gap-2 whitespace-normal rounded-full border border-[var(--color-blue-line)] bg-white/80 px-3 py-1 text-xs font-medium leading-5 text-[var(--color-accent)] sm:text-sm">
                <Archive size={15} /> Marketplace buku untuk semua kategori
              </p>
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.02] text-[var(--color-ink)] sm:text-6xl lg:text-7xl">
                Buddybooks
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[var(--color-ink-soft)] sm:text-lg sm:leading-8">
                Bangun etalase buku online yang rapi untuk menjual buku baru, bekas, pelajaran, anak, fiksi, nonfiksi, hingga koleksi khusus dengan stok, harga, pesanan, dan kanal penjualan dalam satu ruang kerja.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <NavLink
                  to="/dashboard"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 sm:w-auto"
                >
                  Mulai Kelola Toko <ChevronRight size={17} />
                </NavLink>
                <NavLink
                  to="/catalog"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-blue-line)] bg-white/86 px-5 py-3 text-sm font-semibold text-[var(--color-accent)] sm:w-auto"
                >
                  Lihat Katalog <LibraryBig size={17} />
                </NavLink>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-5 text-sm text-[var(--color-ink-soft)] md:grid-cols-4 lg:px-8">
            {[
              ["Katalog siap jual", "Judul, harga, stok"],
              ["Semua jenis buku", "Baru, bekas, koleksi"],
              ["Transaksi rapi", "Pesanan dan pembayaran"],
              ["Multi kanal", "Toko, sosial, lokapasar"],
            ].map(([label, detail]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                <span><strong className="text-[var(--color-ink)]">{label}</strong> {detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Fondasi Marketplace</p>
            <h2 className="mt-3 text-4xl font-semibold">Dibangun untuk toko buku yang ingin tumbuh rapi.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflowItems.map((item) => (
              <div key={item.title} className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm shadow-blue-950/[0.04]">
                <item.icon className="text-[var(--color-accent)]" size={24} />
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="bg-[var(--color-surface)] py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Alur Kerja</p>
              <h2 className="mt-3 text-4xl font-semibold">Dari tambah buku sampai pesanan terkirim.</h2>
              <p className="mt-4 leading-7 text-[var(--color-ink-soft)]">
                Halaman publik membantu pembeli menemukan buku, sementara dasbor membantu tim mengatur stok, harga, status jual, kurir, pembayaran, dan histori transaksi.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-xl shadow-blue-950/[0.06]">
              <div className="grid gap-3 sm:grid-cols-3">
                {["Tambah buku", "Atur harga", "Terbitkan"].map((step, index) => (
                  <div key={step} className="rounded-lg bg-[var(--color-surface)] p-4">
                    <span className="text-xs font-semibold text-[var(--color-accent)]">0{index + 1}</span>
                    <p className="mt-2 font-semibold">{step}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-[var(--color-blue-line)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-[var(--color-ink-soft)]">Aktivitas hari ini</p>
                    <p className="mt-1 text-2xl font-semibold">18 pesanan diproses</p>
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                    <QrCode size={28} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="reader" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["Etalase publik", "Tampilkan buku dalam kartu yang mudah dipindai pembeli.", BookOpenCheck],
              ["Pencarian cepat", "Bantu pembeli menemukan judul, penulis, kategori, atau penerbit.", Search],
              ["Data toko aman", "Harga modal, lokasi stok, dan catatan internal tetap terpisah.", LockKeyhole],
            ].map(([title, detail, Icon]) => (
              <div key={title as string} className="rounded-lg border border-[var(--color-border)] bg-white p-6">
                <Icon className="text-[var(--color-accent)]" size={24} />
                <h3 className="mt-5 text-xl font-semibold">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">{detail as string}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function PublicCatalogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");

  const visibleBooks = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return featuredBooks.filter((book) => {
      const matchesCategory = activeCategory === "Semua" || book.category === activeCategory;
      const matchesSearch =
        keyword === "" ||
        [book.title, book.author, book.publisher, book.code, book.category].some((value) =>
          value.toLowerCase().includes(keyword),
        );
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  return (
    <div className="min-h-screen bg-white text-[var(--color-ink)]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <LibraryBig size={20} />
            </span>
            <span className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-normal">
              Buddybooks
            </span>
          </NavLink>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--color-ink-soft)] md:flex">
            <NavLink to="/" className="hover:text-[var(--color-accent)]">Beranda</NavLink>
            <NavLink to="/catalog" className="text-[var(--color-accent)]">Katalog</NavLink>
            <NavLink to="/dashboard" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-white shadow-sm shadow-blue-900/10">
              Masuk Dasbor
            </NavLink>
          </nav>
          <NavLink
            to="/dashboard"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)] md:hidden"
            aria-label="Buka dasbor"
          >
            <Menu size={18} />
          </NavLink>
        </div>
      </header>

      <main className="pt-20">
        <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div className="self-end">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Katalog Buku</p>
              <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
                Temukan buku untuk dibaca, dikoleksi, dan dibeli.
              </h1>
              <p className="mt-4 max-w-xl leading-7 text-[var(--color-ink-soft)]">
                Etalase publik untuk menampilkan buku baru, bekas, pendidikan, anak, bisnis, fiksi, dan koleksi khusus lengkap dengan sampul, harga, kondisi, dan ketersediaan.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <NavLink
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15"
                >
                  Kelola katalog <ChevronRight size={17} />
                </NavLink>
                <NavLink
                  to="/"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-blue-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-accent)]"
                >
                  Kembali beranda
                </NavLink>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Total Buku", featuredBooks.length.toString()],
                ["Kategori", "6"],
                ["Siap Dijual", "130"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm shadow-blue-950/[0.03]">
                  <p className="text-sm text-[var(--color-ink-muted)]">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4 shadow-sm shadow-blue-950/[0.03]">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-muted)] md:max-w-md">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
                placeholder="Cari judul, penulis, penerbit"
              />
            </label>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
              {publicCategoryFilters.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold ${
                    activeCategory === category
                      ? "bg-[var(--color-accent)] text-white"
                      : "border border-[var(--color-border)] bg-white text-[var(--color-ink-soft)] hover:border-[var(--color-blue-line)] hover:text-[var(--color-accent)]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleBooks.map((book) => (
              <PublicCatalogCard key={book.code} book={book} />
            ))}
          </div>

          {visibleBooks.length === 0 && (
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-ink-muted)]">
              Tidak ada buku yang cocok dengan filter.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PublicCatalogCard({ book }: { book: (typeof featuredBooks)[number] }) {
  const stockValue = Number.parseInt(book.stock, 10) || 0;
  const stockProgress = Math.min(100, Math.max(8, Math.round((stockValue / 50) * 100)));

  return (
    <article className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm shadow-blue-950/[0.03] transition hover:-translate-y-0.5 hover:border-[var(--color-blue-line)] hover:shadow-xl hover:shadow-blue-950/[0.08]">
      <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 p-4">
        <div
          role="img"
          aria-label={`Sampul ${book.title}`}
          className={`relative aspect-[3/4] overflow-hidden rounded-md bg-gradient-to-br ${book.coverTone} shadow-lg shadow-blue-950/15`}
        >
          <div className="absolute inset-x-0 top-0 h-12 bg-white/18" />
          <div className="absolute inset-y-0 left-3 w-px bg-white/22" />
          <div className="absolute inset-x-4 top-5 border-t border-white/32" />
          <div className="absolute inset-x-4 bottom-5 border-t border-white/32" />
          <div className="absolute inset-0 flex flex-col justify-between p-4 text-white">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">{book.category}</span>
            <div>
              <p className="line-clamp-3 font-[family-name:var(--font-heading)] text-lg font-semibold leading-tight">
                {book.title}
              </p>
              <p className="mt-2 line-clamp-1 text-[11px] opacity-86">{book.year}</p>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--color-accent)]">{book.code}</p>
              <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-[var(--color-ink)]">
                {book.title}
              </h2>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
              {book.category}
            </span>
          </div>

          <p className="mt-2 truncate text-sm text-[var(--color-ink-soft)]">{book.author}</p>
          <p className="mt-1 truncate text-xs text-[var(--color-ink-muted)]">{book.publisher}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <PublicInfoPill icon={Calendar} value={book.year} />
            <PublicInfoPill icon={PackageSearch} value={book.stock} />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-ink-muted)]">Kondisi</p>
            <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{book.condition}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-ink-muted)]">Harga</p>
            <p className="text-sm font-semibold text-[var(--color-ink)]">{book.price}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
            <span>Stok</span>
            <span>{book.stock}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[var(--color-surface)]">
            <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${stockProgress}%` }} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--color-ink-muted)]">
            <PackageSearch size={14} className="text-[var(--color-accent)]" />
            <span className="truncate">{book.location}</span>
          </span>
          <button
            type="button"
            className="inline-grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-soft)] shadow-sm hover:border-[var(--color-blue-line)] hover:text-[var(--color-accent)]"
            title="Lihat detail"
            aria-label={`Lihat detail ${book.title}`}
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function PublicInfoPill({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2.5 py-2 text-[var(--color-ink-soft)]">
      <Icon size={14} className="shrink-0 text-[var(--color-accent)]" />
      <span className="truncate">{value}</span>
    </span>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("buddybooks.sidebarCollapsed") === "true";
  });
  const [masterOpen, setMasterOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("buddybooks.masterOpen");
    return saved === null ? true : saved === "true";
  });
  const [debugOpen, setDebugOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem("buddybooks.debugOpen");
    return saved === null ? false : saved === "true";
  });
  // Drawer navigasi mobile (< lg): sidebar asli disembunyikan lewat
  // "hidden lg:block" jadi tidak ada menu sama sekali di layar kecil tanpa
  // ini. Dibuka lewat tombol hamburger di header, ditutup otomatis begitu
  // rute berganti (lihat useEffect di bawah).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const masterActive = location.pathname.startsWith("/master/");
  const debugActive = debugNavItems.some((item) => location.pathname === item.to);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("buddybooks.sidebarCollapsed", String(next));
      return next;
    });
  }

  function toggleMaster() {
    setMasterOpen((value) => {
      const next = !value;
      window.localStorage.setItem("buddybooks.masterOpen", String(next));
      return next;
    });
  }

  function toggleDebug() {
    setDebugOpen((value) => {
      const next = !value;
      window.localStorage.setItem("buddybooks.debugOpen", String(next));
      return next;
    });
  }

  return (
    <div
      className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)] lg:grid"
      style={{ gridTemplateColumns: sidebarCollapsed ? "88px minmax(0, 1fr)" : "280px minmax(0, 1fr)" }}
    >
      <aside className="hidden border-r border-[var(--color-border)] bg-white lg:block">
        <div className={`sticky top-0 flex h-screen flex-col ${sidebarCollapsed ? "p-4" : "p-5"}`}>
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between gap-3"}`}>
            <NavLink
              to="/"
              className={`flex min-w-0 items-center gap-3 py-2 ${sidebarCollapsed ? "justify-center px-0" : "px-2"}`}
              aria-label="Buddybooks"
            >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
              <LibraryBig size={21} />
            </span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
              <p className="font-[family-name:var(--font-heading)] text-xl font-semibold">Buddybooks</p>
              <p className="text-xs text-[var(--color-ink-muted)]">Ruang kerja toko buku</p>
            </div>
            )}
          </NavLink>
            <button
              type="button"
              onClick={toggleSidebar}
              className={`grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] ${
                sidebarCollapsed ? "absolute left-14 top-5 bg-white shadow-sm" : ""
              }`}
              aria-label={sidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
              title={sidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
            >
              {sidebarCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
            </button>
          </div>

          <nav className="mt-8 space-y-1">
            {appNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg py-2.5 text-sm font-medium transition ${
                    sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${
                    isActive
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                  }`
                }
              >
                <item.icon size={18} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            ))}

            <div className="pt-2">
              <button
                type="button"
                onClick={toggleMaster}
                title={sidebarCollapsed ? "Data Master" : undefined}
                className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition ${
                  sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
                } ${
                  masterActive
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                }`}
              >
                <Database size={18} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">Data Master</span>
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${masterOpen ? "rotate-90" : ""}`}
                    />
                  </>
                )}
              </button>

              {!sidebarCollapsed && masterOpen && (
                <div className="mt-1 space-y-1 border-l border-[var(--color-border)] pl-3">
                  {masterNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                            : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                        }`
                      }
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={toggleDebug}
                title={sidebarCollapsed ? "Debug" : undefined}
                className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition ${
                  sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
                } ${
                  debugActive
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                }`}
              >
                <Bug size={18} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">Debug</span>
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${debugOpen || debugActive ? "rotate-90" : ""}`}
                    />
                  </>
                )}
              </button>

              {!sidebarCollapsed && (debugOpen || debugActive) && (
                <div className="mt-1 space-y-1 border-l border-[var(--color-border)] pl-3">
                  {debugNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                            : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                        }`
                      }
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>

      {/* Drawer navigasi mobile (< lg): duplikat konten sidebar di atas,
          karena <aside> itu "hidden lg:block" jadi tak pernah tampil di HP.
          Dibuka lewat tombol hamburger di header, ditutup lewat backdrop,
          tombol X, atau otomatis saat pindah rute. */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(84vw,300px)] flex-col overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <NavLink
                to="/"
                className="flex min-w-0 items-center gap-3 px-2 py-2"
                aria-label="Buddybooks"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-accent)] text-white">
                  <LibraryBig size={21} />
                </span>
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-heading)] text-xl font-semibold">Buddybooks</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">Ruang kerja toko buku</p>
                </div>
              </NavLink>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup menu"
              >
                <X size={17} />
              </button>
            </div>

            <nav className="mt-6 space-y-1">
              {appNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                    }`
                  }
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={toggleMaster}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    masterActive
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Database size={18} />
                  <span className="flex-1 text-left">Data Master</span>
                  <ChevronRight size={16} className={`transition-transform ${masterOpen ? "rotate-90" : ""}`} />
                </button>

                {masterOpen && (
                  <div className="mt-1 space-y-1 border-l border-[var(--color-border)] pl-3">
                    {masterNavItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                            isActive
                              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                              : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                          }`
                        }
                      >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={toggleDebug}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    debugActive
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Bug size={18} />
                  <span className="flex-1 text-left">Debug</span>
                  <ChevronRight
                    size={16}
                    className={`transition-transform ${debugOpen || debugActive ? "rotate-90" : ""}`}
                  />
                </button>

                {(debugOpen || debugActive) && (
                  <div className="mt-1 space-y-1 border-l border-[var(--color-border)] pl-3">
                    {debugNavItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                            isActive
                              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                              : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                          }`
                        }
                      >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-5 py-3 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)] lg:hidden"
              aria-label="Buka menu"
              title="Buka menu"
            >
              <Menu size={18} />
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden h-8 w-1 rounded-full bg-[var(--color-accent)] sm:block" />
              <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{getPageTitle(location.pathname)}</p>
            </div>

            <div className="ml-auto hidden h-10 w-[min(34vw,420px)] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-muted)] md:flex">
              <Search size={16} />
              <span className="truncate">Cari judul, inventaris, penerbit, lokasi</span>
            </div>

            <NavLink
              to="/scan-session"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-accent)] text-white shadow-sm shadow-blue-900/10"
              aria-label="Pindai"
              title="Pindai"
            >
              <ScanLine size={17} />
            </NavLink>
          </div>
        </header>
        <main className="p-5 lg:p-8">{children}</main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--color-card)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-border)",
          },
        }}
      />
    </div>
  );
}

function DashboardPage() {
  const dashboardPagination = usePagination(dashboardRows, {
    initialPageSize: 5,
    resetKey: "dashboard-inventory",
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm shadow-blue-950/[0.03]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--color-ink-soft)]">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-normal">{metric.value}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <metric.icon size={21} />
              </span>
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--color-accent)]">{metric.change}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm shadow-blue-950/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Ringkasan Penjualan</h1>
              <p className="text-sm text-[var(--color-ink-soft)]">Stok, harga, pesanan, dan performa katalog dalam satu layar.</p>
            </div>
            <button className="rounded-lg border border-[var(--color-blue-line)] px-3 py-2 text-sm font-semibold text-[var(--color-accent)]">
              Ekspor Laporan
            </button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="min-h-72 rounded-lg bg-[var(--color-surface)] p-5">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-accent)]">Potensi nilai katalog</p>
                  <p className="mt-3 text-5xl font-semibold tracking-normal">Rp 3,8 M</p>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Berdasarkan harga jual aktif dari 834 buku.</p>
                </div>
                <div className="mt-8 flex items-end gap-2">
                  {[42, 58, 46, 72, 64, 88, 78, 96].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-md bg-[var(--color-accent)]/80" style={{ height }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                ["Baru", "42%", "bg-blue-700"],
                ["Bekas", "24%", "bg-sky-500"],
                ["Akademik", "21%", "bg-cyan-500"],
                ["Koleksi", "8%", "bg-slate-400"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border)] p-4">
                  <p className="text-sm text-[var(--color-ink-soft)]">{label}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${color}`} />
                    <p className="text-2xl font-semibold">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm shadow-blue-950/[0.03]">
          <h2 className="text-2xl font-semibold">Prioritas Hari Ini</h2>
          <div className="mt-5 space-y-3">
            {[
              ["Inspeksi jamur", "9 eksemplar berisiko aktif", ClipboardCheck],
              ["Pindai tertunda", "24 halaman belum OCR", ScanLine],
              ["Lokasi kosong", "7 eksemplar belum punya rak", MapPin],
              ["Hak akses baca", "3 akses baca perlu ditinjau", Users],
            ].map(([title, detail, Icon]) => (
              <div key={title as string} className="flex gap-3 rounded-lg bg-[var(--color-surface)] p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[var(--color-accent)]">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-semibold">{title as string}</p>
                  <p className="text-sm text-[var(--color-ink-soft)]">{detail as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="text-2xl font-semibold">Alur Pemindaian</h2>
          <div className="mt-5 space-y-4">
            {[
              ["Foto halaman", "Pemindai browser", "100%"],
              ["OCR RapidOCR", "Layanan lokal", "72%"],
              ["Koreksi manual", "Keyakinan rendah", "38%"],
            ].map(([title, detail, progress]) => (
              <div key={title}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{title}</span>
                  <span className="text-[var(--color-ink-soft)]">{detail}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--color-surface)]">
                  <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: progress }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Inventaris Terbaru</h2>
              <p className="text-sm text-[var(--color-ink-soft)]">Tampilan tabel padat untuk kerja katalog harian.</p>
            </div>
            <PackageSearch className="text-[var(--color-accent)]" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[var(--color-ink-soft)]">
                  {["Kode", "Judul", "Kelas", "Kondisi", "Lokasi"].map((head) => (
                    <th key={head} className="border-b border-[var(--color-border)] px-3 py-3 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dashboardPagination.pageItems.map((row) => (
                  <tr key={row[0]} className="hover:bg-[var(--color-surface)]">
                    {row.map((cell, index) => (
                      <td key={cell} className="border-b border-[var(--color-border)] px-3 py-3">
                        {index === 0 ? <span className="font-semibold text-[var(--color-accent)]">{cell}</span> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={dashboardPagination.page}
            pageSize={dashboardPagination.pageSize}
            pageSizeOptions={[5, 10, 25]}
            totalItems={dashboardPagination.totalItems}
            totalPages={dashboardPagination.totalPages}
            onPageChange={dashboardPagination.setPage}
            onPageSizeChange={dashboardPagination.setPageSize}
          />
        </div>
      </section>
    </div>
  );
}

function MasterDataPage({ item }: { item: (typeof masterNavItems)[number] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["master", item.resource],
    queryFn: () => listMasterItems(item.resource),
  });
  const {
    data: selectedDetail,
    isFetching: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["master-detail", item.resource, selectedID],
    queryFn: () => getMasterDetail(item.resource, selectedID ?? ""),
    enabled: selectedID !== null,
  });
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const typeColumnLabel = item.resource === "publishers" ? "Kategori" : "Kode / Tipe";
  const rows = (data ?? []).filter((row) => {
    if (!normalizedSearch) return true;
    return [row.name, row.code].some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  const pagination = usePagination(rows, {
    initialPageSize: 25,
    resetKey: `${item.resource}:${normalizedSearch}`,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <item.icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{item.label}</p>
            <p className="truncate text-xs text-[var(--color-ink-muted)]">{item.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="hidden h-10 min-w-72 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-muted)] md:flex">
            <Search size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
              placeholder="Cari data master"
            />
          </label>
          <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
            Tambah
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-[var(--color-ink-soft)]">
              <tr>
                <th className="border-b border-[var(--color-border)] px-4 py-3 font-medium">Nama</th>
                <th className="border-b border-[var(--color-border)] px-4 py-3 font-medium">{typeColumnLabel}</th>
                <th className="sticky right-0 z-10 w-14 border-b border-l border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-center font-medium shadow-[-8px_0_18px_rgba(15,23,42,0.05)]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-4 py-10 text-center text-[var(--color-ink-muted)]" colSpan={3}>
                    Memuat data master...
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="px-4 py-10 text-center text-red-700" colSpan={3}>
                    Gagal memuat data master.
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-[var(--color-ink-muted)]" colSpan={3}>
                    Data belum tersedia.
                  </td>
                </tr>
              )}
              {!isLoading && !error && pagination.pageItems.map((row) => {
                const isSelected = selectedID === row.id;
                return (
                  <tr
                    key={row.id}
                    className={`group ${isSelected ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-surface)]"}`}
                  >
                    <td className="border-b border-[var(--color-border)] px-4 py-3 font-medium text-[var(--color-ink)]">
                      {row.name}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 text-[var(--color-ink-soft)]">
                      {row.code || "-"}
                    </td>
                    <td className={`sticky right-0 z-10 w-14 border-b border-l border-[var(--color-border)] px-2 py-2 text-center shadow-[-8px_0_18px_rgba(15,23,42,0.05)] ${isSelected ? "bg-[var(--color-accent-soft)]" : "bg-white group-hover:bg-[var(--color-surface)]"}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedID(row.id)}
                        className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-soft)] shadow-sm hover:border-[var(--color-blue-line)] hover:text-[var(--color-accent)]"
                        title="Lihat detail"
                        aria-label={`Lihat detail ${row.name}`}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isLoading && !error && rows.length > 0 && (
            <TablePagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          )}
        </div>

      </div>

      {selectedID && (
        <MasterDetailPanel
          detail={selectedDetail}
          isLoading={isDetailLoading}
          hasError={Boolean(detailError)}
          onClose={() => setSelectedID(null)}
        />
      )}
    </div>
  );
}

function MasterDetailPanel({
  detail,
  isLoading,
  hasError,
  onClose,
}: {
  detail?: MasterDetail;
  isLoading: boolean;
  hasError: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="fixed bottom-0 right-0 top-[73px] z-30 flex w-full max-w-[420px] flex-col border-l border-[var(--color-border)] bg-white shadow-[-18px_0_45px_rgba(15,23,42,0.12)] sm:max-w-[440px]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">Detail</p>
          <h2 className="mt-1 truncate text-base font-semibold text-[var(--color-ink)]">
            {detail?.name ?? "Memuat detail"}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{detail?.code || detail?.status || "Data master"}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-blue-line)] hover:text-[var(--color-accent)]"
          aria-label="Tutup detail"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-muted)]">
            Memuat detail...
          </div>
        )}
        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Detail gagal dimuat.
          </div>
        )}
        {!isLoading && !hasError && detail?.sections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
              {section.title}
            </h3>
            <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              {section.fields.map((field) => (
                <div key={`${section.title}-${field.label}`} className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-[var(--color-border)] last:border-b-0">
                  <dt className="bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-ink-muted)]">
                    {field.label}
                  </dt>
                  <dd className="min-w-0 px-3 py-2 text-xs leading-5 text-[var(--color-ink-soft)]">
                    <DetailValue field={field} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  );
}

function DetailValue({ field }: { field: { value: string; kind?: string } }) {
  if (!field.value) {
    return <span className="text-[var(--color-ink-muted)]">-</span>;
  }
  if (field.kind === "url") {
    return (
      <a
        href={field.value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
      >
        <span className="truncate">{field.value}</span>
        <ExternalLink size={12} className="shrink-0" />
      </a>
    );
  }
  if (field.kind === "email") {
    return (
      <a href={`mailto:${field.value}`} className="font-medium text-[var(--color-accent)] hover:underline">
        {field.value}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap break-words">{field.value}</span>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<PublicCatalogPage />} />
        <Route path="/dashboard" element={<AppShell><DashboardPage /></AppShell>} />
        <Route path="/collections" element={<AppShell><CollectionsListPage /></AppShell>} />
        <Route path="/collections/:collectionCode" element={<AppShell><CollectionDetailPage /></AppShell>} />
        <Route path="/copies/:collectionCode/:inventoryCode" element={<AppShell><CopyDetailPage /></AppShell>} />
        <Route path="/design-kit" element={<AppShell><DesignKitPage /></AppShell>} />
        <Route path="/reader-demo" element={<AppShell><ReaderDemoPage /></AppShell>} />
        <Route path="/scanner-demo" element={<AppShell><ScannerDemoPage /></AppShell>} />
        <Route path="/scan-session" element={<AppShell><ScanSessionPage /></AppShell>} />
        {masterNavItems.map((item) => (
          <Route
            key={item.to}
            path={item.to}
            element={<AppShell><MasterDataPage item={item} /></AppShell>}
          />
        ))}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
