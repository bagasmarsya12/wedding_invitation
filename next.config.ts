import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'" },
    ];
    const privatePage = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      { source: "/", headers: security },
      { source: "/:path*", headers: security },
      { source: "/invite/:path*", headers: privatePage },
      { source: "/api/invite/:path*", headers: privatePage },
      { source: "/admin/:path*", headers: privatePage },
      { source: "/api/admin/:path*", headers: privatePage },
    ];
  },
};

export default nextConfig;
