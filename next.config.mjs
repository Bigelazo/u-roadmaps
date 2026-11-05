/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingIncludes: {
    '/*': ['./src/generated/prisma/**'],
  },
  reactStrictMode: true,
  // The path carries the engine's version, so its contents never change.
  headers() {
    return [
      {
        source: '/vendor/libavoid/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
