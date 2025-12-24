import { describe, expect, it } from "vitest";
import { channel } from "./channel";

describe("channel", () => {
	it("should be an async iterable", () => {
		const ch = channel<number>();
		expect(ch[Symbol.asyncIterator]).toBeDefined();
		expect(ch[Symbol.asyncIterator]()).toBe(ch);
		ch.close();
	});

	it("should deliver pushed values to consumers", async () => {
		const ch = channel<string>();

		ch.push("hello");
		ch.push("world");

		const result1 = await ch.next();
		const result2 = await ch.next();

		expect(result1).toEqual({ value: "hello", done: false });
		expect(result2).toEqual({ value: "world", done: false });

		ch.close();
	});

	it("should wait for values when none are buffered", async () => {
		const ch = channel<number>();

		// Start waiting before pushing
		const promise = ch.next();

		// Push after a small delay
		setTimeout(() => ch.push(42), 10);

		const result = await promise;
		expect(result).toEqual({ value: 42, done: false });

		ch.close();
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
		expect(await ch.next()).toEqual({ value: 3, done: false });
		expect(await ch.next()).toEqual({ value: 4, done: false });
		expect(await ch.next()).toEqual({ value: 5, done: false });

		ch.close();
	});

	it("should respect maxBuffer: 0 (no buffering)", async () => {
		const ch = channel<number>({ maxBuffer: 0 });

		// Push without a waiting consumer - should be dropped
		ch.push(1);
		ch.push(2);

		// Start waiting
		const promise = ch.next();

		// This push should be delivered
		ch.push(3);

		const result = await promise;
		expect(result).toEqual({ value: 3, done: false });

		ch.close();
	});

	it("should return done after close (buffer is not drained by default)", async () => {
		const ch = channel<number>();

		ch.push(1);
		ch.close();

		// Closing immediately ends iteration, buffer is not drained
		expect(await ch.next()).toEqual({ value: undefined, done: true });
		expect(await ch.next()).toEqual({ value: undefined, done: true });
	});

	it("should drain buffer when drain option is true", async () => {
		const ch = channel<number>({ drain: true });

		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.close();

		// Should still get buffered values after close
		expect(await ch.next()).toEqual({ value: 1, done: false });
		expect(await ch.next()).toEqual({ value: 2, done: false });
		expect(await ch.next()).toEqual({ value: 3, done: false });

		// Now should be done
		expect(await ch.next()).toEqual({ value: undefined, done: true });
	});

	it("should drain to waiting consumers on close when drain is true", async () => {
		const ch = channel<number>({ drain: true });

		// Start waiting
		const promise1 = ch.next();
		const promise2 = ch.next();

		// Push and close
		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.close();

		// Waiting consumers should get values
		expect(await promise1).toEqual({ value: 1, done: false });
		expect(await promise2).toEqual({ value: 2, done: false });

		// Remaining buffered value should still be available
		expect(await ch.next()).toEqual({ value: 3, done: false });
		expect(await ch.next()).toEqual({ value: undefined, done: true });
	});

	it("should work with for await when drain is true", async () => {
		const ch = channel<number>({ drain: true });
		const results: number[] = [];

		// Push some values and close
		ch.push(1);
		ch.push(2);
		ch.push(3);
		ch.close();

		for await (const value of ch) {
			results.push(value);
		}

		expect(results).toEqual([1, 2, 3]);
	});

	it("should resolve waiting consumers with done on close", async () => {
		const ch = channel<number>();

		// Start waiting
		const promise = ch.next();

		// Close while waiting
		ch.close();

		const result = await promise;
		expect(result).toEqual({ value: undefined, done: true });
	});

	it("should ignore pushes after close", async () => {
		const ch = channel<number>();

		ch.close();
		ch.push(1); // Should be ignored

		const result = await ch.next();
		expect(result).toEqual({ value: undefined, done: true });
	});

	it("should have closed property", () => {
		const ch = channel<number>();

		expect(ch.closed).toBe(false);
		ch.close();
		expect(ch.closed).toBe(true);
	});

	it("should be disposable", () => {
		const ch = channel<number>();

		expect(ch[Symbol.dispose]).toBeDefined();
		ch[Symbol.dispose]();
		expect(ch.closed).toBe(true);
	});

	it("should work with using statement", async () => {
		const results: number[] = [];

		{
			using ch = channel<number>();

			ch.push(1);
			ch.push(2);

			results.push((await ch.next()).value!);
			results.push((await ch.next()).value!);
		}

		expect(results).toEqual([1, 2]);
	});

	it("should return done when calling return()", async () => {
		const ch = channel<number>();

		ch.push(1);

		const returnResult = await ch.return!();
		expect(returnResult).toEqual({ value: undefined, done: true });

		// Should be closed now
		expect(ch.closed).toBe(true);
		expect(await ch.next()).toEqual({ value: undefined, done: true });
	});

	it("should handle multiple waiting consumers correctly", async () => {
		const ch = channel<number>();

		// Queue up multiple consumers
		const promise1 = ch.next();
		const promise2 = ch.next();
		const promise3 = ch.next();

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

		ch.close();
	});

	it("should work with for await...of loop", async () => {
		const ch = channel<number>();
		const results: number[] = [];

		// Start consuming in background
		const consumer = (async () => {
			for await (const value of ch) {
				results.push(value);
			}
		})();

		// Push values
		ch.push(1);
		ch.push(2);
		ch.push(3);

		// Allow microtasks to process
		await new Promise((r) => setTimeout(r, 10));

		ch.close();
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
			ch.close();
		})();

		for await (const value of ch) {
			results.push(value);
		}

		await producer;
		expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("should only close once", () => {
		const ch = channel<number>();

		ch.close();
		ch.close(); // Should not throw
		ch.close();

		expect(ch.closed).toBe(true);
	});
});
