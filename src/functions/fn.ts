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
 * Utility just invokes the method being called immediatly.
 * Useful to scope resources to calling body.
 * @param fn
 * @returns Result of fn
 * @example
 * ```ts
 * import {invoke, once} from "indisposed";
 * import {WebSocketServer} from "ws";
 *
 * await invoke(async () => {
 * 	const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
 * 	using listening = once(wss, 'listening');
 * 	using error = once(wss, 'error', true);
 *
 * 	await Promise.race([listening, error]);
 *
 * 	return wss;
 * });
 * ```
 */
export function invoke<TResult>(fn: () => TResult) {
	return fn();
}
