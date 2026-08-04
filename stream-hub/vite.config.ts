import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export const APP_VERSION = "0.3.5";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "MAX MEDIA PLAYER",
        short_name: "MAX",
        description: "MAX MEDIA PLAYER — واجهة موحّدة للبث",
        theme_color: "#070b18",
        background_color: "#070b18",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
});
