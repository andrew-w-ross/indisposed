/** Function that performs cleanup for a disposable resource */
export type DisposeFn<T> = (value: T) => unknown;

/**
 * Object with a Symbol.dispose method for automatic cleanup
 * @see {@link toDisposable}
 */
export type Disposable<T extends object> = ReturnType<typeof toDisposable<T>>;

/**
 * Make a value disposable by adding a Symbol.dispose method
 * @param value item to make disposable (must be an extensible object)
 * @param disposeFn function that will cleanup the item
 * @returns value that's disposable
 * @example
 * ```ts
 * // Direct usage with extensible objects
 * const resource = toDisposable({ handle: 123 }, (r) => closeHandle(r.handle));
 * using handle = resource; // automatically disposed at end of scope
 *
 * // For non-extensible values (primitives, sealed objects, class instances), wrap them:
 * const connection = new WebSocket('ws://localhost');
 * const disposableConnection = toDisposable(
 *   { socket: connection },
 *   (wrapped) => wrapped.socket.close()
 * );
 * using conn = disposableConnection;
 * ```
 */
export function toDisposable<T extends object>(
	value: T,
	disposeFn: DisposeFn<T>,
) {
	let disposed = false;
	const originalDispose = (value as any)[Symbol.dispose];
	return Object.assign(value, {
		[Symbol.dispose]: () => {
			if (disposed) return;
			disposeFn(value);
			if (typeof originalDispose === "function") {
				originalDispose.call(value);
			}
			disposed = true;
		},
	});
}

/** Async function that performs cleanup for a disposable resource */
export type AsyncDispose<T> = (value: T) => PromiseLike<unknown>;

/**
 * Object with a Symbol.asyncDispose method for automatic async cleanup
 * @see {@link toAsyncDisposable}
 */
export type AsyncDisposable<T extends object> = ReturnType<
	typeof toAsyncDisposable<T>
>;

/**
 * Make a value async disposable by adding a Symbol.asyncDispose method
 * @param value item to make disposable (must be an extensible object)
 * @param disposeFn async function that will cleanup the item
 * @returns value that's async disposable
 * @example
 * ```ts
 * // Direct usage with extensible objects
 * const resource = toAsyncDisposable({ stream: fs.createReadStream('file.txt') }, async (r) => {
 *   await r.stream.close();
 * });
 * await using file = resource; // automatically disposed at end of scope
 *
 * // For non-extensible values (sealed objects, class instances), wrap them:
 * const database = new DatabaseConnection();
 * const disposableDb = toAsyncDisposable(
 *   { connection: database },
 *   async (wrapped) => {
 *     await wrapped.connection.close();
 *   }
 * );
 * await using db = disposableDb;
 * ```
 */
export function toAsyncDisposable<T extends object>(
	value: T,
	disposeFn: AsyncDispose<T>,
) {
	let disposingPromise: PromiseLike<unknown> | undefined;
	const originalDispose = (value as any)[Symbol.asyncDispose];

	return Object.assign(value, {
		[Symbol.asyncDispose]: async () => {
			if (disposingPromise == null) {
				disposingPromise = (async () => {
					await disposeFn(value);
					if (typeof originalDispose === "function") {
						await originalDispose.call(value);
					}
				})();
			}
			await disposingPromise;
		},
	});
}
