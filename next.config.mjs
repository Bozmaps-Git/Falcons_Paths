import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            { from: path.join("node_modules", "cesium", "Build", "Cesium", "Workers"), to: "../public/cesium/Workers" },
            { from: path.join("node_modules", "cesium", "Build", "Cesium", "ThirdParty"), to: "../public/cesium/ThirdParty" },
            { from: path.join("node_modules", "cesium", "Build", "Cesium", "Assets"), to: "../public/cesium/Assets" },
            { from: path.join("node_modules", "cesium", "Build", "Cesium", "Widgets"), to: "../public/cesium/Widgets" },
          ],
        })
      );
    }
    return config;
  },

  env: {
    CESIUM_BASE_URL: "/cesium",
    NEXT_PUBLIC_CESIUM_ION_TOKEN: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "",
  },
};

export default nextConfig;
