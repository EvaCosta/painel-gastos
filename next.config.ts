import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os painéis são sempre renderizados no servidor: nunca queremos uma versão
  // em cache de uma pessoa a ser servida a outra.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
