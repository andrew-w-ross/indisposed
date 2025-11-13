import type { EventHandlerParams, EventNames, Fn } from "~/types";
import { toDisposable } from "./disposable";
import { type UnpackArray, unpackArray } from "./fn";

export type Subscription = (event: any, handler: Fn) => any;

/**
 * Represents an event emitter with an `off` method for removing listeners.
 */
export type HasOff = {
	off: Subscription;
};

/**
 * Represents an event emitter with an `on` method for registering listeners.
 */
export type HasOn = {
	on: Subscription;
} & HasOff;

/**
 * Represents an event emitter with a `once` method for one-time listeners.
 */
export type HasOnce = {
	once: Subscription;
} & HasOff;

export type OnceResult<
	EventEmitter extends HasOnce,
	Event extends EventNames<EventEmitter["once"]>,
	Rejects extends boolean,
> = Rejects extends true
	? never
	: UnpackArray<EventHandlerParams<EventEmitter["once"], Event>>;

/**
 * Type-safe wrapper for event emitter's `once` method that preserves overload signatures.
 *
 * The return value is automatically unpacked:
 * - Handlers with 0 parameters resolve to `undefined`
 * - Handlers with 1 parameter resolve to that single value
 * - Handlers with 2+ parameters resolve to an array of values
 *
 * @param emitter - Event emitter with `once` and `off` methods
 * @param event - Event name (must match one of the emitter's overloads)
 * @param rejects - When true, the promise rejects with the handler arguments instead of resolving
 * @returns Disposable promise with the handler arguments and automatic cleanup via `off`
 *
 * @example
 * ```ts
 * type MyEmitter = {
 *   once(event: 'data', handler: (value: string) => void): void;
 *   once(event: 'error', handler: (error: Error) => void): number;
 *   once(event: 'multi', handler: (x: number, y: number) => void): void;
 *   off(event: string, handler: Fn): void;
 * };
 *
 * declare const emitter: MyEmitter;
 *
 * // Single parameter: returns the value directly
 * using result = once(emitter, 'data');
 * console.log((await result).toUpperCase()); // string
 *
 * // Multiple parameters: returns as array
 * using coords = once(emitter, 'multi');
 * const [x, y] = await coords; // [number, number]
 * ```
 */
export function once<
	EventEmitter extends HasOnce,
	const Event extends EventNames<EventEmitter["once"]>,
	const Rejects extends boolean = false,
>(emitter: EventEmitter, event: Event, rejects?: Rejects) {
	const { promise, resolve, reject } =
		Promise.withResolvers<OnceResult<EventEmitter, Event, Rejects>>();

	const handler: Fn = (...args: unknown[]) => {
		if (rejects) {
			reject(args.length === 1 ? args[0] : args);
			return;
		}
		resolve(unpackArray(args) as OnceResult<EventEmitter, Event, Rejects>);
	};
	emitter.once(event, handler);
	return toDisposable(promise, () => emitter.off(event, handler));
}

export type OnResult<
	EventEmitter extends HasOn,
	Event extends EventNames<EventEmitter["on"]>,
> = UnpackArray<EventHandlerParams<EventEmitter["on"], Event>>;

/**
 * Type-safe wrapper for event emitter's `on` method that returns an async iterator.
 *
 * The yielded values are automatically unpacked:
 * - Handlers with 0 parameters yield `undefined`
 * - Handlers with 1 parameter yield that single value
 * - Handlers with 2+ parameters yield an array of values
 *
 * @param emitter - Event emitter with `on` and `off` methods
 * @param event - Event name (must match one of the emitter's overloads)
 * @param maxBuffer - Maximum number of events to buffer (default: 100)
 * @returns Disposable async iterator that yields handler arguments
 *
 * @example
 * ```ts
 * type MyEmitter = {
 *   on(event: 'data', handler: (value: string) => void): void;
 *   on(event: 'position', handler: (x: number, y: number) => void): void;
 *   off(event: string, handler: Fn): void;
 * };
 *
 * declare const emitter: MyEmitter;
 *
 * // Single parameter: yields values directly
 * using iterator = on(emitter, 'data');
 * for await (const value of iterator) {
 *   console.log(value.toUpperCase()); // string
 * }
 *
 * // Multiple parameters: yields as array
 * using positions = on(emitter, 'position');
 * for await (const [x, y] of positions) {
 *   console.log(`Position: ${x}, ${y}`);
 * }
 * ```
 */
export function on<
	EventEmitter extends HasOn,
	const Event extends EventNames<EventEmitter["on"]>,
>(emitter: EventEmitter, event: Event, maxBuffer = 100) {
	type Item = OnResult<EventEmitter, Event>;
	type IterationResult = IteratorResult<Item, undefined>;

	let done = false;
	const events: Item[] = [];
	const waiters: ((value: IterationResult) => void)[] = [];

	const doneResult = () => ({
		value: undefined,
		done: true as const,
	});

	const drain = () => {
		// Pair off as many as possible, FIFO ↔ FIFO
		while (!done && events.length && waiters.length) {
			const value = events.shift()!;
			const resolve = waiters.shift()!;
			resolve({ value, done: false });
		}
	};

	const handler = (...args: unknown[]) => {
		if (done) return;
		const value = unpackArray(args) as Item;

		if (maxBuffer <= 0) {
			if (waiters.length) events.push(value); // only deliver to waiters
		} else {
			events.push(value);
			if (events.length > maxBuffer) events.shift();
		}
		drain();
	};

	emitter.on(event, handler);

	const dispose = () => {
		if (done) return;
		emitter.off(event, handler);
		done = true;

		while (waiters.length > 0) {
			const waiter = waiters.shift();
			waiter?.(doneResult());
		}
	};

	const iterator: AsyncIterableIterator<Item, undefined, void> = {
		async next() {
			// If already disposed, return done
			if (done) {
				return doneResult();
			}

			if (events.length)
				return { value: events.shift()!, done: false } as const;

			// Wait for the next event
			return new Promise<IterationResult>((resolve) => {
				waiters.push(resolve);
				drain();
			});
		},
		return() {
			dispose();
			return Promise.resolve(doneResult());
		},
		[Symbol.asyncIterator]() {
			return this;
		},
	};

	return toDisposable(iterator, dispose);
}
