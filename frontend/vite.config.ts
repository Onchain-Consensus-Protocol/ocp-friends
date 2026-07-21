import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        rules: resolve(__dirname, "friends-market-rules.html"),
        create: resolve(__dirname, "create-friends-market.html"),
        browse: resolve(__dirname, "browse-friends-market.html"),
        market: resolve(__dirname, "friends-market.html"),
      },
    },
  },
});
