// Memuat OpenCV.js dari salinan lokal (public/vendor/opencv.js, dibundel
// dari paket jscanify sendiri agar versi API cocok), bukan dari CDN,
// konsisten dengan prinsip "self-hosted, tanpa request eksternal" di
// proyek ini (lihat font @fontsource, model AI lokal).
//
// window.cv perlu menunggu 'onRuntimeInitialized' karena bagian WASM-nya
// dimuat asinkron setelah skrip utama dieksekusi.

declare global {
  interface Window {
    cv: unknown;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadOpenCv(): Promise<void> {
  if (window.cv && typeof (window.cv as any).Mat === "function") {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/opencv.js";
    script.async = true;
    script.onerror = () => reject(new Error("Gagal memuat OpenCV.js"));
    script.onload = () => {
      const cv = window.cv as any;
      if (cv?.onRuntimeInitialized !== undefined) {
        cv["onRuntimeInitialized"] = () => resolve();
      } else {
        // Fallback bila struktur build berbeda: cek berkala.
        const check = setInterval(() => {
          if (window.cv && typeof (window.cv as any).Mat === "function") {
            clearInterval(check);
            resolve();
          }
        }, 100);
      }
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
