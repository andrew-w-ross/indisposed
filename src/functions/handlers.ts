import type { EventHandlerParams, EventNames, Fn } from "#/types";
import { toDisposable } from "#/functions/disposable";
import { channel, type ChannelOptions } from "#/functions/channel";
import { type UnpackArray, unpackArray } from "#/functions/fn";

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
 * @param options - Channel options (maxBuffer, etc.)
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
>(emitter: EventEmitter, event: Event, options?: ChannelOptions) {
	type Item = OnResult<EventEmitter, Event>;

	const ch = channel<Item>(options);

	const handler = (...args: unknown[]) => {
		ch.push(unpackArray(args) as Item);
	};

	emitter.on(event, handler);

	return toDisposable(ch.iterator, () => {
		emitter.off(event, handler);
	});
}
