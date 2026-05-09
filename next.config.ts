const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true // Force disable to clear service worker cache
});

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  /* config options here */
};

module.exports = withPWA(nextConfig);
