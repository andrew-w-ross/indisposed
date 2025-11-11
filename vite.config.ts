import { defineConfig } from "vite";

export default defineConfig({
	build: {
		emptyOutDir: false,
		sourcemap: true,
		lib: {
			entry: {
				index: "src/index.ts",
				"no-polyfill": "src/no-polyfill.ts",
			},
			formats: ["es"],
		},
		target: "es2022",
		rollupOptions: {
			external: ["core-js/proposals/explicit-resource-management"],
			output: {
				preserveModules: true,
				preserveModulesRoot: "src",
				entryFileNames: "[name].js",
			},
		},
	},
	optimizeDeps: {
		exclude: ["core-js", "core-js/proposals/explicit-resource-management"],
	},
});
