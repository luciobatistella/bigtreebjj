/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite validar o build enquanto o servidor local mantém `.next` aberto.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@thebigtreebjj/ui', '@thebigtreebjj/shared-types']
};

module.exports = nextConfig;
