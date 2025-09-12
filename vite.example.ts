
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    base: './',
    build: {
        sourcemap: true,
        outDir: 'example-build',
        minify: false,
    },
    server: {
        host: '0.0.0.0'
    }
})
