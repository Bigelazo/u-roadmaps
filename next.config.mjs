/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingIncludes: {
    '/*': ['./src/generated/prisma/**'],
  },
  reactStrictMode: true,
  headers() {
    return [
      {
        source: '/vendor/libavoid/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/vendor/libavoid/:version/LICENSE',
        headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }],
      },
    ];
  },
};

export default nextConfig;
