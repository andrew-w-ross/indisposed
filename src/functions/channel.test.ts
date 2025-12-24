import { describe, expect, it } from "vitest";
import { channel } from "./channel";

describe("channel", () => {
	it("should return a channel with push, closed, and iterator", () => {
		const ch = channel<number>();
		expect(ch.push).toBeDefined();
		expect(ch.closed).toBe(false);
		expect(ch.iterator).toBeDefined();
		expect(ch.iterator[Symbol.asyncIterator]).toBeDefined();
		ch.iterator[Symbol.dispose]();
	});

	it("iterator should be an async iterable", () => {
		const ch = channel<number>();
		expect(ch.iterator[Symbol.asyncIterator]).toBeDefined();
		expect(ch.iterator[Symbol.asyncIterator]()).toBe(ch.iterator);
		ch.iterator[Symbol.dispose]();
	});

	it("should deliver pushed values to consumers", async () => {
		const ch = channel<string>();

		ch.push("hello");
		ch.push("world");

		const result1 = await ch.iterator.next();
		const result2 = await ch.iterator.next();

		expect(result1).toEqual({ value: "hello", done: false });
		expect(result2).toEqual({ value: "world", done: false });

		ch.iterator[Symbol.dispose]();
	});

	it("should wait for values when none are buffered", async () => {
		const ch = channel<number>();

		// Start waiting before pushing
		const promise = ch.iterator.next();

		// Push after a small delay
		setTimeout(() => ch.push(42), 10);

		const result = await promise;
		expect(result).toEqual({ value: 42, done: false });

		ch.iterator[Symbol.dispose]();
	});

	it("should buffer events up to maxBuffer", async () => {
		const ch = channel<number>({ maxBuffer: 3 });

		// Push more than buffer size
		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.push(4); // Should drop 1
		ch.push(5); // Should drop 2

		// Should only get the last 3 events
		expect(await ch.iterator.next()).toEqual({ value: 3, done: false });
		expect(await ch.iterator.next()).toEqual({ value: 4, done: false });
		expect(await ch.iterator.next()).toEqual({ value: 5, done: false });

		ch.iterator[Symbol.dispose]();
	});

	it("should respect maxBuffer: 0 (no buffering)", async () => {
		const ch = channel<number>({ maxBuffer: 0 });

		// Push without a waiting consumer - should be dropped
		ch.push(1);
		ch.push(2);

		// Start waiting
		const promise = ch.iterator.next();

		// This push should be delivered
		ch.push(3);

		const result = await promise;
		expect(result).toEqual({ value: 3, done: false });

		ch.iterator[Symbol.dispose]();
	});

	it("should return done after dispose (buffer is not drained by default)", async () => {
		const ch = channel<number>();

		ch.push(1);
		ch.iterator[Symbol.dispose]();

		// Disposing immediately ends iteration, buffer is not drained
		expect(await ch.iterator.next()).toEqual({ value: undefined, done: true });
		expect(await ch.iterator.next()).toEqual({ value: undefined, done: true });
	});

	it("should drain buffer when drain option is true", async () => {
		const ch = channel<number>({ drain: true });

		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.iterator[Symbol.dispose]();

		// Should still get buffered values after dispose
		expect(await ch.iterator.next()).toEqual({ value: 1, done: false });
		expect(await ch.iterator.next()).toEqual({ value: 2, done: false });
		expect(await ch.iterator.next()).toEqual({ value: 3, done: false });

		// Now should be done
		expect(await ch.iterator.next()).toEqual({ value: undefined, done: true });
	});

	it("should drain to waiting consumers on dispose when drain is true", async () => {
		const ch = channel<number>({ drain: true });

		// Start waiting
		const promise1 = ch.iterator.next();
		const promise2 = ch.iterator.next();

		// Push and dispose
		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.iterator[Symbol.dispose]();

		// Waiting consumers should get values
		expect(await promise1).toEqual({ value: 1, done: false });
		expect(await promise2).toEqual({ value: 2, done: false });

		// Remaining buffered value should still be available
		expect(await ch.iterator.next()).toEqual({ value: 3, done: false });
		expect(await ch.iterator.next()).toEqual({ value: undefined, done: true });
	});

	it("should work with for await when drain is true", async () => {
		const ch = channel<number>({ drain: true });
		const results: number[] = [];

		// Push some values and dispose
		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.iterator[Symbol.dispose]();

		for await (const value of ch.iterator) {
			results.push(value);
		}

		expect(results).toEqual([1, 2, 3]);
	});

	it("should resolve waiting consumers with done on dispose", async () => {
		const ch = channel<number>();

		// Start waiting
		const promise = ch.iterator.next();

		// Dispose while waiting
		ch.iterator[Symbol.dispose]();

		const result = await promise;
		expect(result).toEqual({ value: undefined, done: true });
	});

	it("should ignore pushes after dispose", async () => {
		const ch = channel<number>();

		ch.iterator[Symbol.dispose]();
		ch.push(1); // Should be ignored

		const result = await ch.iterator.next();
		expect(result).toEqual({ value: undefined, done: true });
	});

	it("should have closed property", () => {
		const ch = channel<number>();

		expect(ch.closed).toBe(false);
		ch.iterator[Symbol.dispose]();
		expect(ch.closed).toBe(true);
	});

	it("iterator should be disposable", () => {
		const ch = channel<number>();

		expect(ch.iterator[Symbol.dispose]).toBeDefined();
		ch.iterator[Symbol.dispose]();
		expect(ch.closed).toBe(true);
	});

	it("should work with using statement", async () => {
		const results: number[] = [];

		const ch = channel<number>();
		{
			using iter = ch.iterator;

			ch.push(1);
			ch.push(2);

			results.push((await iter.next()).value!);
			results.push((await iter.next()).value!);
		}

		expect(results).toEqual([1, 2]);
		expect(ch.closed).toBe(true);
	});

	it("should return done when calling return()", async () => {
		const ch = channel<number>();

		ch.push(1);

		const returnResult = await ch.iterator.return!();
		expect(returnResult).toEqual({ value: undefined, done: true });

		// Should be closed now
		expect(ch.closed).toBe(true);
		expect(await ch.iterator.next()).toEqual({ value: undefined, done: true });
	});

	it("should handle multiple waiting consumers correctly", async () => {
		const ch = channel<number>();

		// Queue up multiple consumers
		const promise1 = ch.iterator.next();
		const promise2 = ch.iterator.next();
		const promise3 = ch.iterator.next();

		// Push values
		ch.push(1);
		ch.push(2);
		ch.push(3);

		const [result1, result2, result3] = await Promise.all([
			promise1,
			promise2,
			promise3,
		]);

		expect(result1.value).toBe(1);
		expect(result2.value).toBe(2);
		expect(result3.value).toBe(3);

		ch.iterator[Symbol.dispose]();
	});

	it("should work with for await...of loop", async () => {
		const ch = channel<number>();
		const results: number[] = [];

		// Start consuming in background
		const consumer = (async () => {
			for await (const value of ch.iterator) {
				results.push(value);
			}
		})();

		// Push values
		ch.push(1);
		ch.push(2);
		ch.push(3);

		// Allow microtasks to process
		await new Promise((r) => setTimeout(r, 10));

		ch.iterator[Symbol.dispose]();
		await consumer;

		expect(results).toEqual([1, 2, 3]);
	});

	it("should handle rapid push and consume", async () => {
		const ch = channel<number>();
		const results: number[] = [];

		const producer = (async () => {
			for (let i = 0; i < 10; i++) {
				ch.push(i);
				await new Promise((r) => setTimeout(r, 1));
			}
			ch.iterator[Symbol.dispose]();
		})();

		for await (const value of ch.iterator) {
			results.push(value);
		}

		await producer;
		expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("should only dispose once", () => {
		const ch = channel<number>();

		ch.iterator[Symbol.dispose]();
		ch.iterator[Symbol.dispose](); // Should not throw
		ch.iterator[Symbol.dispose]();

		expect(ch.closed).toBe(true);
	});
});
