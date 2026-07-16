/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fonts load from the CDN in the browser; don't inline them at build time.
  optimizeFonts: false,
};
export default nextConfig;
