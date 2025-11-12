/**
 * Supported event names types
 */
export type EventName = symbol | string;

/**
 * Represents any function with any parameters and return type.
 */
export type Fn = (...args: any) => any;

/**
 * Extracts function overloads as a union type.
 *
 * TypeScript normally collapses all overloads into a single signature.
 * This utility preserves each overload as a separate member of a union type.
 */
export type OverLoadFunctions<FunctionType> = FunctionType extends {
	(...args: infer A1): infer R1;
	(...args: infer A2): infer R2;
	(...args: infer A3): infer R3;
	(...args: infer A4): infer R4;
	(...args: infer A5): infer R5;
	(...args: infer A6): infer R6;
	(...args: infer A7): infer R7;
	(...args: infer A8): infer R8;
	(...args: infer A9): infer R9;
	(...args: infer A10): infer R10;
}
	?
			| ((...p: A1) => R1)
			| ((...p: A2) => R2)
			| ((...p: A3) => R3)
			| ((...p: A4) => R4)
			| ((...p: A5) => R5)
			| ((...p: A6) => R6)
			| ((...p: A7) => R7)
			| ((...p: A8) => R8)
			| ((...p: A9) => R9)
			| ((...p: A10) => R10)
	: never;

/**
 * Extracts the parameter types of a function as a tuple.
 */
export type ExtractParams<T> = T extends (...args: infer P) => any ? P : never;

/**
 * Extracts literal event names from parameter tuples.
 *
 * Assumes the first parameter is a literal type (for `on`, `once`, `off` events).
 * Must be a standalone type to ensure union distribution works correctly.
 */
type NakedEventNames<Parameters> = Parameters extends [infer E, ...unknown[]]
	? E extends EventName
		? E
		: never
	: never;

/**
 * Extracts a union of all event names from event handler function overloads.
 *
 * Assumes the standard event handler signature: `(event: literal, handler: fn) => void`.
 * Returns a union of all literal event names from the function's overloads.
 */
export type EventNames<Functions> = NakedEventNames<
	Parameters<OverLoadFunctions<Functions>>
>;

type DistributeParams<Parameters, Event> = Parameters extends unknown
	? Parameters extends [Event, infer Handler]
		? ExtractParams<Handler> extends infer P
			? P extends any[]
				? any[] extends P
					? never
					: P
				: never
			: never
		: never
	: never;

/**
 * Extracts the parameter types of the handler function for a specific event.
 *
 * Given an event name, returns the parameter types of the handler function
 * (the second argument in the event handler signature).
 */
export type EventHandlerParams<Functions, Event> = DistributeParams<
	Parameters<OverLoadFunctions<Functions>>,
	Event
>;
