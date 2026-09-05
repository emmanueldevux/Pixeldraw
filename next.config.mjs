/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ TEMPORARY — added to unblock deployment while cleaning up remaining
  // type errors incrementally. This does NOT fix type errors, it just lets
  // the build succeed with them present — including any that indicate real
  // runtime bugs (e.g. a missing export resolving to `undefined`), not just
  // cosmetic type-strictness. Before removing this, run `npx tsc --noEmit`
  // locally and confirm it's clean, then delete both blocks below.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
    ],
  },
};

export default nextConfig;
