/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async redirects() {
    return [{ source: '/demo-premium', destination: '/portal-crecimiento', permanent: true }];
  },
  async rewrites() {
    const apiBase =
      process.env.CLEEXS_API_PROXY_TARGET || 'https://cleexsapi-production.up.railway.app';
    return [
      {
        source: '/proxy-api/:path*',
        destination: `${apiBase.replace(/\/$/, '')}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' }],
      },
      {
        source: '/api/admin-ui/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
