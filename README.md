# indisposed

[![CI](https://github.com/andrew-w-ross/indisposed/actions/workflows/ci.yml/badge.svg)](https://github.com/andrew-w-ross/indisposed/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/indisposed.svg)](https://www.npmjs.com/package/indisposed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The missing utilities for JavaScript's [Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management) (`using` and `await using` declarations).

## Features

- 🧹 **Resource Management** - Convert any resource into a disposable with `toDisposable` and `toAsyncDisposable`
- 🎧 **Event Handlers** - Transform event emitters into disposable iterators with `on` and promises with `once`
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

### `on(emitter, event, maxBuffer?)`

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
