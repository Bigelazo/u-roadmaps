/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./src/generated/prisma/**'],
  },
  reactStrictMode: true,
};

export default nextConfig;
