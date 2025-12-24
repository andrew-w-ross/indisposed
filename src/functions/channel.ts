export type ChannelOptions = {
	/**
	 * Maximum amount of events to be buffered.
	 * When buffer is full, oldest events are dropped.
	 * Set to 0 to disable buffering (only deliver to waiting consumers).
	 * @default 100
	 */
	maxBuffer?: number;

	/**
	 * Whether to drain buffered events before ending iteration on dispose.
	 * When true, buffered events will still be yielded after dispose is called.
	 * When false, dispose immediately ends iteration and discards buffered events.
	 * @default false
	 */
	drain?: boolean;
};

const DEFAULT_OPTIONS = {
	maxBuffer: 100,
	drain: false,
} satisfies ChannelOptions;

/**
 * The iterator portion of a channel - this is what consumers see.
 */
export type ChannelIterator<T> = AsyncIterableIterator<T, undefined, void> & {
	[Symbol.dispose]: () => void;
};

/**
 * The full channel handle with push capability - for internal/producer use.
 */
export type Channel<T> = {
	/**
	 * Push a value into the channel.
	 * If there are waiting consumers, the value is delivered immediately.
	 * Otherwise, it's buffered (subject to maxBuffer).
	 */
	push: (value: T) => void;
	/**
	 * Whether the channel is closed.
	 */
	readonly closed: boolean;
	/**
	 * The async iterator for consuming values.
	 * This is what should be exposed to downstream consumers.
	 */
	iterator: ChannelIterator<T>;
};

/**
 * Creates a buffered async channel for pushing values and consuming them via async iteration.
 *
 * This is a low-level primitive for building async iterators from push-based sources
 * like event emitters, intervals, or any producer that pushes values over time.
 *
 * The returned channel has a `push` method for producers and an `iterator` property
 * for consumers. Only expose the `iterator` to downstream code.
 *
 * @param options - Channel configuration
 * @returns A channel with push capability and a disposable async iterator
 *
 * @example
 * ```ts
 * // Basic usage - producer keeps the channel, consumer gets the iterator
 * const ch = channel<string>();
 *
 * // Producer side
 * ch.push("hello");
 * ch.push("world");
 *
 * // Consumer side - only sees the iterator
 * for await (const value of ch.iterator) {
 *   console.log(value);
 *   if (shouldStop) break;
 * }
 * ```
 *
 * @example
 * ```ts
 * // Building a custom async iterator
 * function myAsyncSource() {
 *   const ch = channel<number>();
 *   // ... set up producer that calls ch.push()
 *   return ch.iterator; // Only expose the iterator
 * }
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

	const dispose = () => {
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

	const iterator: ChannelIterator<T> = {
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
			dispose();
			return Promise.resolve(doneResult());
		},
		[Symbol.asyncIterator]() {
			return this;
		},
		[Symbol.dispose]: dispose,
	};

	return {
		push,
		get closed() {
			return closed;
		},
		iterator,
	};
}
