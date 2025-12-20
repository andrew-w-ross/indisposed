import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		tsconfigPaths(),
		//@ts-expect-error Internal type issue
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
