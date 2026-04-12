import type { NextConfig } from "next";

const DEV_PRIVATE_NETWORK_ORIGINS = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, index) => `172.${index + 16}.*.*`),
  "*.local",
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Allow LAN-origin access to Next.js dev internals (HMR/runtime) for phone testing.
  // Without this, pages can render but never hydrate when opened via local IP.
  allowedDevOrigins:
    process.env.NODE_ENV === "development" ? DEV_PRIVATE_NETWORK_ORIGINS : undefined,
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
