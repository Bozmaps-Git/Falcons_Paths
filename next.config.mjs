/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        http: false,
        https: false,
        zlib: false,
      };
      // Load Cesium from the pre-built global script (/cesium/Cesium.js) instead of
      // bundling from source — avoids octal-escape SyntaxErrors in Cesium's source files.
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : [];
      config.externals = [...existing, { cesium: "Cesium" }];
    }
    return config;
  },

  env: {
    CESIUM_BASE_URL: "/cesium",
  },

  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
