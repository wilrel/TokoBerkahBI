import type { NextConfig } from "next";

// Backend FastAPI. Browser memanggil /api di origin yang sama, lalu Next.js
// meneruskannya ke sini, jadi tidak ada alamat localhost yang tertanam di
// kode client dan tidak perlu CORS.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
