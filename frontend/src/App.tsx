import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import CollectionsPage from "./features/collections/CollectionsPage";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav>
        <Link to="/">Dashboard</Link> | <Link to="/collections">Koleksi</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}

function DashboardPage() {
  return <h1>Buddybooks</h1>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
