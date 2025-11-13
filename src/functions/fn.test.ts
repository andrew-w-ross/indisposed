import { describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { invoke, unpackArray } from "./fn";
import { once } from "./handlers";
import { toAsyncDisposable } from "./disposable";

describe("unpackArray", () => {
	it("returns undefined for empty array", () => {
		const result = unpackArray([]);
		expect(result).toBeUndefined();
	});

	it("returns single element for array with one item", () => {
		const result = unpackArray(["single"]);
		expect(result).toBe("single");
	});

	it("returns the array itself for multiple elements", () => {
		const result = unpackArray(["first", "second"]);
		expect(result).toEqual(["first", "second"]);
	});

	it("handles different types correctly", () => {
		expect(unpackArray([42])).toBe(42);
		expect(unpackArray([true, false])).toEqual([true, false]);
		expect(unpackArray([{ a: 1 }])).toEqual({ a: 1 });
	});
});

describe("invoke", () => {
	it("immediately invokes the provided function", () => {
		const spy = vi.fn(() => 1);

		const result = invoke(spy);
		expect(result).toEqual(1);

		expect(spy).toHaveBeenCalledOnce();
	});

	it("works with WebSocketServer example from documentation", async () => {
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

		expect(wss).toBeInstanceOf(WebSocketServer);
		expect(wss.address()).toBeTruthy();
	});
});
