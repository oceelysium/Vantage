import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
    plugins: [solidPlugin()],
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    server: {
        port: 3000,
        watch: {
            ignored: ['**/src-tauri/target/**'],
        },
    },
    build: {
        target: "esnext",
    },
});
