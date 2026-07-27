/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite validar o build enquanto o servidor local mantém `.next` aberto.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@thebigtreebjj/ui', '@thebigtreebjj/shared-types'],
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, nosnippet' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
