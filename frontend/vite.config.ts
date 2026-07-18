import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        rules: resolve(__dirname, "private-vault-rules.html"),
        create: resolve(__dirname, "create-private-vault.html"),
        browse: resolve(__dirname, "browse-private-vault.html"),
        vault: resolve(__dirname, "private-vault.html"),
      },
    },
  },
});
