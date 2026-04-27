/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async redirects() {
    return [{ source: '/demo-premium', destination: '/portal-crecimiento', permanent: true }];
  },
};

module.exports = nextConfig;
