import { toDisposable } from "./disposable";
import { channel, type ChannelOptions } from "./channel";

/**
 * Creates a disposable promise that resolves after a specified delay.
 *
 * The timeout is automatically cleared when disposed, preventing
 * memory leaks and unnecessary timer execution.
 *
 * @param ms - Delay in milliseconds before the promise resolves
 * @returns A disposable promise that resolves to `void` after the delay
 *
 * @example
 * ```ts
 * // Basic usage - wait for 1 second
 * await timeout(1000);
 * console.log("1 second passed");
 * ```
 *
 * @example
 * ```ts
 * // With using - automatically clears timeout when scope exits
 * {
 *   using timer = timeout(5000);
 *   await timer;
 * } // timeout cleared if scope exits early
 * ```
 *
 * @example
 * ```ts
 * // Racing with other promises - losing timeout is cleaned up
 * {
 *   using timer = timeout(10000);
 *   using data = once(socket, "data");
 *
 *   await Promise.race([timer, data]);
 * } // both cleaned up regardless of which wins
 * ```
 */
export function timeout(ms: number) {
	const timingPromise = Promise.withResolvers<void>();
	const timeoutId = setTimeout(timingPromise.resolve, ms);

	return toDisposable(timingPromise.promise, () => clearTimeout(timeoutId));
}

export type IntervalOptions = ChannelOptions;

/**
 * Creates a disposable async iterator that yields incrementing numbers at a fixed interval.
 *
 * Values start at 0 and increment by 1 for each interval tick. The interval
 * is automatically cleared when the iterator is disposed or iteration ends.
 *
 * @param ms - Interval duration in milliseconds between each tick
 * @param options - Channel options for buffering behavior
 * @param options.maxBuffer - Maximum events to buffer (default: 100). Set to 0 for no buffering.
 * @param options.drain - Whether to drain buffer on close (default: false)
 * @returns A disposable async iterator yielding incrementing numbers
 *
 * @example
 * ```ts
 * // Basic usage - tick every second
 * {
 *   using ticks = interval(1000);
 *
 *   for await (const tick of ticks) {
 *     console.log(`Tick ${tick}`); // 0, 1, 2, ...
 *     if (tick >= 5) break;
 *   }
 * } // interval automatically cleared
 * ```
 *
 * @example
 * ```ts
 * // Polling pattern
 * {
 *   using poll = interval(5000);
 *
 *   for await (const _ of poll) {
 *     const status = await checkStatus();
 *     if (status === "complete") break;
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // With no buffering - only deliver to waiting consumers
 * const ticks = interval(100, { maxBuffer: 0 });
 * ```
 */
export function interval(ms: number, options?: IntervalOptions) {
	const ch = channel<number>(options);
	let currentValue = 0;

	const intervalId = setInterval(() => {
		if (ch.closed) return;
		ch.push(currentValue++);
	}, ms);

	return toDisposable(ch.iterator, () => {
		clearInterval(intervalId);
	});
}
