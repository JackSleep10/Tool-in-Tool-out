import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), viteSingleFile()],
    build: {
        outDir: 'dist',
        assetsInlineLimit: 100000000, // Inline everything
        chunkSizeWarningLimit: 100000000,
        minify: false, // Make output readable
    }
})
