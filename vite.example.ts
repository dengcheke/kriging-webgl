
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    base: './',
    build: {
        sourcemap: true,
        outDir: 'docs',
        minify: false,
    },
    server: {
        host: '0.0.0.0'
    }
})
