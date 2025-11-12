import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	resolve: {
		conditions: ["development"],
	},
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
