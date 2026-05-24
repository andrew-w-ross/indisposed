import { defineConfig } from "vitest/config";
import dts from "unplugin-dts/vite";

export default defineConfig({
	plugins: [
		dts({
			tsconfigPath: "./tsconfig.app.json",
		}),
	],
	resolve: {
		conditions: ["development"],
	},
	build: {
		emptyOutDir: true,
		sourcemap: true,
		minify: false,
		lib: {
			entry: {
				index: "src/index.ts",
				"no-polyfill": "src/no-polyfill.ts",
			},
			formats: ["es"],
		},
		// core-js is an optional peer dependency, not something we ship — keep
		// the polyfill imports external so the consumer's core-js is used.
		rollupOptions: {
			external: [/^core-js(\/|$)/],
		},
		target: "es2022",
	},
	test: {
		typecheck: {
			enabled: true,
			include: ["src/**/*.test-d.ts"],
			checker: "tsc",
			tsconfig: "./tsconfig.test.json",
		},
	},
});
