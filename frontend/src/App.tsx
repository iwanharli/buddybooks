import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster } from "sonner";
import CollectionsPage from "./features/collections/CollectionsPage";
import DesignKitPage from "./pages/DesignKitPage";
import ReaderDemoPage from "./pages/ReaderDemoPage";
import ScannerDemoPage from "./pages/ScannerDemoPage";
import ScanSessionPage from "./pages/ScanSessionPage";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-parchment)] text-[var(--color-ink)]">
      <nav className="flex gap-4 border-b border-[var(--color-border)] px-8 py-4 text-sm">
        <Link to="/">Dashboard</Link>
        <Link to="/collections">Koleksi</Link>
        <Link to="/design-kit">Design Kit</Link>
        <Link to="/reader-demo">Reader Demo</Link>
        <Link to="/scanner-demo">Scanner Demo</Link>
        <Link to="/scan-session">Sesi Pemindaian</Link>
      </nav>
      <main>{children}</main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--color-parchment)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-border)",
          },
        }}
      />
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl">Buddybooks</h1>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/design-kit" element={<DesignKitPage />} />
          <Route path="/reader-demo" element={<ReaderDemoPage />} />
          <Route path="/scanner-demo" element={<ScannerDemoPage />} />
          <Route path="/scan-session" element={<ScanSessionPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
