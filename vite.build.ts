
import { defineConfig } from "vite";
import { dependencies } from './package.json'
// https://vite.dev/config/
export default defineConfig({
    build: {
        emptyOutDir: true,
        lib: {
            entry: './src/index.ts',
            fileName: 'index',
            formats: ['es', 'cjs'],
            name: "KrigingWebGL"
        },
        rollupOptions: {
            external: Object.keys(dependencies)
        }
    }
})
