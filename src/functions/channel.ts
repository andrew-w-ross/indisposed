import { toDisposable } from "./disposable";

export type ChannelOptions = {
	/**
	 * Maximum amount of events to be buffered.
	 * When buffer is full, oldest events are dropped.
	 * Set to 0 to disable buffering (only deliver to waiting consumers).
	 * @default 100
	 */
	maxBuffer?: number;

	/**
	 * Whether to drain buffered events before ending iteration on close.
	 * When true, buffered events will still be yielded after close() is called.
	 * When false, close() immediately ends iteration and discards buffered events.
	 * @default false
	 */
	drain?: boolean;
};

const DEFAULT_OPTIONS = {
	maxBuffer: 100,
	drain: false,
} satisfies ChannelOptions;

export type Channel<T> = AsyncIterableIterator<T, undefined, void> & {
	/**
	 * Push a value into the channel.
	 * If there are waiting consumers, the value is delivered immediately.
	 * Otherwise, it's buffered (subject to maxBuffer).
	 */
	push: (value: T) => void;
	/**
	 * Close the channel. No more values can be pushed.
	 * If drain is false (default), waiting consumers will receive done immediately.
	 * If drain is true, buffered events will be delivered before done.
	 */
	close: () => void;
	/**
	 * Whether the channel is closed.
	 */
	readonly closed: boolean;
	[Symbol.dispose]: () => void;
};

/**
 * Creates a buffered async channel for pushing values and consuming them via async iteration.
 *
 * This is a low-level primitive for building async iterators from push-based sources
 * like event emitters, intervals, or any producer that pushes values over time.
 *
 * @param options - Channel configuration
 * @returns A disposable async iterator with a `push` method
 *
 * @example
 * ```ts
 * // Basic usage
 * const ch = channel<string>();
 * ch.push("hello");
 * ch.push("world");
 *
 * for await (const value of ch) {
 *   console.log(value); // "hello", "world"
 *   if (shouldStop) ch.close();
 * }
 * ```
 *
 * @example
 * ```ts
 * // With event emitter
 * const ch = channel<string>();
 * emitter.on("data", (data) => ch.push(data));
 * emitter.on("end", () => ch.close());
 *
 * for await (const data of ch) {
 *   process(data);
 * }
 * ```
 *
 * @example
 * ```ts
 * // No buffering - only deliver to waiting consumers
 * const ch = channel<number>({ maxBuffer: 0 });
 * ```
 */
export function channel<T>(options?: ChannelOptions): Channel<T> {
	const { maxBuffer, drain: shouldDrain } = { ...DEFAULT_OPTIONS, ...options };
	type IterationResult = IteratorResult<T, undefined>;

	let closed = false;
	const events: T[] = [];
	const waiters: ((value: IterationResult) => void)[] = [];

	const doneResult = (): IterationResult => ({
		value: undefined,
		done: true as const,
	});

	const drainQueue = () => {
		// Pair off as many as possible, FIFO ↔ FIFO
		while (!closed && events.length && waiters.length) {
			const value = events.shift()!;
			const resolve = waiters.shift()!;
			resolve({ value, done: false });
		}
	};

	const push = (value: T) => {
		if (closed) return;

		if (maxBuffer <= 0) {
			// Only deliver to waiting consumers
			if (waiters.length) events.push(value);
		} else {
			events.push(value);
			if (events.length > maxBuffer) events.shift();
		}
		drainQueue();
	};

	const close = () => {
		if (closed) return;
		closed = true;

		if (shouldDrain) {
			// Drain buffered events to waiting consumers before signaling done
			while (events.length && waiters.length) {
				const value = events.shift()!;
				const resolve = waiters.shift()!;
				resolve({ value, done: false });
			}
		}

		// Signal done to remaining waiters
		while (waiters.length > 0) {
			const waiter = waiters.shift();
			waiter?.(doneResult());
		}
	};

	const iterator: Channel<T> = {
		push,
		close,
		get closed() {
			return closed;
		},
		async next() {
			// If drain mode, return buffered events even after close
			if (shouldDrain && events.length) {
				return { value: events.shift()!, done: false } as const;
			}

			if (closed) {
				return doneResult();
			}

			if (events.length) {
				return { value: events.shift()!, done: false } as const;
			}

			// Wait for the next event
			return new Promise<IterationResult>((resolve) => {
				waiters.push(resolve);
				drainQueue();
			});
		},
		return() {
			close();
			return Promise.resolve(doneResult());
		},
		[Symbol.asyncIterator]() {
			return this;
		},
		[Symbol.dispose]: close,
	};

	return toDisposable(iterator, close);
}
