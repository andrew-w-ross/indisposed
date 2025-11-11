const hasNative =
	typeof Symbol.dispose === "symbol" &&
	typeof Symbol.asyncDispose === "symbol";

if (!hasNative) {
	try {
		//@ts-expect-error It exists 
		await import("core-js/proposals/explicit-resource-management");
	} catch {
		//TODO: Maybe log a message here
	}
}
