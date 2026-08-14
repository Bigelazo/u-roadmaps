/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./src/generated/prisma/**'],
  },
  reactStrictMode: true,
};

export default nextConfig;
