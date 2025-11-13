const hasNativeDispose =
	typeof Symbol.dispose === "symbol" && typeof Symbol.asyncDispose === "symbol";

if (!hasNativeDispose) {
	try {
		//@ts-expect-error It exists
		await import("core-js/proposals/explicit-resource-management");
	} catch {
		console.warn(
			`Symbol.dispose and Symbol.asyncDispose are not available in this environment.
			To enable polyfill support, install core-js as a dependency.`,
		);
	}
}

const hasNativeWithResolvers = typeof Promise.withResolvers === "function";

if (!hasNativeWithResolvers) {
	try {
		//@ts-expect-error It exists
		await import("core-js/actual/promise/with-resolvers");
	} catch {
		console.warn(
			`Promise.withResolvers is not available in this environment.
			To enable polyfill support, install core-js as a dependency.`,
		);
	}
}
