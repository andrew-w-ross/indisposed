# indisposed

[![CI](https://github.com/andrew-w-ross/indisposed/actions/workflows/ci.yml/badge.svg)](https://github.com/andrew-w-ross/indisposed/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/indisposed.svg)](https://www.npmjs.com/package/indisposed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The missing utilities for JavaScript's [Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management) (`using` and `await using` declarations).

## Features

- 🧹 **Resource Management** - Convert any resource into a disposable with `toDisposable` and `toAsyncDisposable`
- 🎧 **Event Handlers** - Transform event emitters into disposable iterators with `on` and promises with `once`
- ⏱️ **Timing Utilities** - Disposable `timeout` and `interval` for clean timer management
- 📡 **Channels** - Build async iterators from push-based sources with `channel`
- 🔒 **Scoped Execution** - Execute code with automatic cleanup using `invoke`
- 📦 **Zero Dependencies** - Lightweight and focused
- 🔧 **TypeScript First** - Full type safety and inference
- 🌳 **Tree Shakeable** - Import only what you need

## Installation

```bash
npm install indisposed
# or
yarn add indisposed
# or
pnpm add indisposed
```

## Quick Start

```typescript
import { toAsyncDisposable, once, invoke } from "indisposed";
import { WebSocketServer } from "ws";

// Automatic cleanup with await using
{
	await using wss = await invoke(async () => {
		const wss = toAsyncDisposable(
			new WebSocketServer({ host: "127.0.0.1", port: 0 }),
			(wss) =>
				new Promise((resolve, reject) => {
					wss.close((err) => {
						if (err) return reject(err);
						resolve(undefined);
					});
				}),
		);

		using listening = once(wss, "listening");
		using error = once(wss, "error", true);

		await Promise.race([listening, error]);

		return wss;
	});

	console.log("Server ready at", wss.address());
	// ... handle connections ...
}
// wss is automatically closed once the scope ends
```

## API Reference

### `toDisposable<T>(value, disposeFn)`

Make any object disposable by adding a `Symbol.dispose` method.

```typescript
import { toDisposable } from "indisposed";

const resource = toDisposable({ handle: 123 }, (r) =>
	console.log(`Closing handle ${r.handle}`),
);

{
	using r = resource;
	// use resource
} // automatically disposed here
```

### `toAsyncDisposable<T>(value, disposeFn)`

Make any object async disposable by adding a `Symbol.asyncDispose` method.

```typescript
import { toAsyncDisposable } from "indisposed";

const resource = toAsyncDisposable(
	{ connection: db },
	async (r) => await r.connection.close(),
);

{
	await using r = resource;
	// use resource
} // automatically disposed here
```

### `once(emitter, event, rejects?)`

Create a disposable promise that resolves/rejects when an event fires once.

The promise result is automatically unpacked based on the handler signature:

- 0 parameters → `undefined`
- 1 parameter → the single value
- 2+ parameters → array of values

```typescript
import { once } from "indisposed";

{
	using promise = once(server, "listening");
	await promise; // waits for 'listening' event
} // removes listener if not yet fired

// Single parameter events return the value directly
{
	using data = once(socket, "message");
	const message = await data; // string (not [string])
}

// Multiple parameters return as array
{
	using result = once(emitter, "result");
	const [status, data] = await result; // [number, object]
}

// Handle errors
{
	using error = once(server, "error", true);
	await error; // rejects if 'error' event fires
}
```

### `on(emitter, event, options?)`

Create a disposable async iterator for multiple events.

Yielded values are automatically unpacked based on the handler signature:

- 0 parameters → `undefined`
- 1 parameter → the single value
- 2+ parameters → array of values

```typescript
import { on } from "indisposed";

// Single parameter events yield values directly
{
	using events = on(emitter, "data");

	for await (const data of events) {
		console.log(data); // string (not [string])
		if (shouldStop) break;
	}
} // automatically removes listener

// Multiple parameters yield as array
{
	using positions = on(emitter, "move");

	for await (const [x, y] of positions) {
		console.log(`Position: ${x}, ${y}`);
	}
}

// With buffer options
{
	using events = on(emitter, "data", { maxBuffer: 10, drain: true });
	// ...
}
```

### `timeout(ms)`

Create a disposable promise that resolves after a delay.

```typescript
import { timeout } from "indisposed";

// Basic usage
await timeout(1000);
console.log("1 second passed");

// With using - automatically clears timeout when scope exits
{
	using timer = timeout(5000);
	await timer;
} // timeout cleared if scope exits early

// Racing with other promises
{
	using timer = timeout(10000);
	using data = once(socket, "data");

	await Promise.race([timer, data]);
} // both cleaned up regardless of which wins
```

### `interval(ms, options?)`

Create a disposable async iterator that yields incrementing numbers at a fixed interval.

```typescript
import { interval } from "indisposed";

// Basic usage - tick every second
{
	using ticks = interval(1000);

	for await (const tick of ticks) {
		console.log(`Tick ${tick}`); // 0, 1, 2, ...
		if (tick >= 5) break;
	}
} // interval automatically cleared

// Polling pattern
{
	using poll = interval(5000);

	for await (const _ of poll) {
		const status = await checkStatus();
		if (status === "complete") break;
	}
}

// With options
const ticks = interval(100, { maxBuffer: 10, drain: true });
```

### `channel<T>(options?)`

Create a buffered async channel for pushing values and consuming them via async iteration.

This is a low-level primitive for building async iterators from push-based sources.
The channel separates producer (`push`) and consumer (`iterator`) concerns - only expose
the `iterator` to downstream code.

**Options:**

- `maxBuffer` - Maximum events to buffer (default: 100). Set to 0 for no buffering.
- `drain` - Whether to drain buffered events on dispose (default: false)

```typescript
import { channel } from "indisposed";

// Basic usage - producer keeps the channel, consumer gets the iterator
const ch = channel<string>();

// Producer side
ch.push("hello");
ch.push("world");

// Consumer side - only sees the iterator
{
	using iter = ch.iterator;
	for await (const value of iter) {
		console.log(value);
		if (shouldStop) break;
	}
}

// Building a custom async source
function createDataStream() {
	const ch = channel<Data>();
	source.on("data", (d) => ch.push(d));
	return ch.iterator; // Only expose the iterator
}
```

### `invoke<T>(fn)`

Immediately invoke a function - useful for scoping resources.

```typescript
import { invoke } from "indisposed";

const result = invoke(() => {
	using resource1 = getResource1();
	using resource2 = getResource2();

	return processResources(resource1, resource2);
}); // resources disposed in reverse order
```

## Polyfills

By default, `indisposed` automatically polyfills `Symbol.dispose` and `Symbol.asyncDispose` when:

1. The environment doesn't natively support these symbols
2. `core-js` is installed as a peer dependency

The polyfill is smart and only applies when needed. If your environment already supports explicit resource management or you don't have `core-js` installed, no polyfill is loaded.

For environments that already support these symbols, you can skip the polyfill check entirely using the no-polyfill entry point:

```typescript
import { toDisposable } from "indisposed/no-polyfill";
```

Or configure your bundler to alias the main export:

```json
{
	"alias": {
		"indisposed": "indisposed/no-polyfill"
	}
}
```

## Requirements

- Node.js >= 22.20.0
- TypeScript >= 5.2.0 (for `using` declarations support)

## License

MIT © [andrew-w-ross](https://github.com/andrew-w-ross)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Resources

- [TC39 Explicit Resource Management Proposal](https://github.com/tc39/proposal-explicit-resource-management)
- [TypeScript 5.2 Release Notes](https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/#using-declarations-and-explicit-resource-management)
