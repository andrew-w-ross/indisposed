const hasNative =
	typeof Symbol.dispose === "symbol" && typeof Symbol.asyncDispose === "symbol";

if (!hasNative) {
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
