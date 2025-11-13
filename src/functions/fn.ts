export type UnpackArray<T extends unknown[]> = T["length"] extends 0
	? undefined
	: T["length"] extends 1
		? T[0]
		: T;

export function unpackArray<T extends unknown[]>(values: T) {
	return (
		values.length === 0 ? undefined : values.length === 1 ? values[0] : values
	) as UnpackArray<T>;
}

/**
 * Utility just invokes the method being called immediately.
 * Useful to scope resources to calling body.
 * @param fn Function to invoke
 * @returns Result of fn
 * @example
 * ```ts
 * import {invoke, once, toAsyncDisposable} from "indisposed";
 * import {WebSocketServer} from "ws";
 *
 * await using wss = await invoke(async () => {
 * 	const wss = toAsyncDisposable(
 * 		new WebSocketServer({ host: '127.0.0.1', port: 0 }),
 * 		(wss) => new Promise((resolve, reject) => {
 * 			wss.close((err) => err ? reject(err) : resolve(undefined));
 * 		})
 * 	);
 * 	using listening = once(wss, 'listening');
 * 	using error = once(wss, 'error', true);
 *
 * 	await Promise.race([listening, error]);
 *
 * 	return wss;
 * });
 * // wss is automatically closed here
 * ```
 */
export function invoke<TResult>(fn: () => TResult) {
	return fn();
}
