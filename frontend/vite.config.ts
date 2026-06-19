import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Assets must remain relative when index.html is opened from the .app bundle.
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
