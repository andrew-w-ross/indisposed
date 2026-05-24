import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { timeout, interval } from "#/functions/timing";

describe("timeout", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should resolve after the specified time", async () => {
		const timer = timeout(1000);

		vi.advanceTimersByTime(999);
		expect(vi.getTimerCount()).toBe(1);

		vi.advanceTimersByTime(1);
		await expect(timer).resolves.toBeUndefined();
	});

	it("should be disposable and clear the timeout", async () => {
		const timer = timeout(1000);

		expect(vi.getTimerCount()).toBe(1);
		timer[Symbol.dispose]();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("should work with using statement", async () => {
		{
			using timer = timeout(5000);
			expect(vi.getTimerCount()).toBe(1);

			vi.advanceTimersByTime(5000);
			await timer;
		}

		expect(vi.getTimerCount()).toBe(0);
	});

	it("should cancel pending timeout when disposed early", async () => {
		const resolved = vi.fn();

		{
			using timer = timeout(1000);
			timer.then(resolved);

			vi.advanceTimersByTime(500);
			expect(resolved).not.toHaveBeenCalled();
		}

		// Timeout was cleared by dispose, but promise may or may not resolve
		// depending on timing - the key test is that the timer is cleared
		expect(vi.getTimerCount()).toBe(0);
	});

	it("should return a thenable promise", async () => {
		const timer = timeout(100);

		expect(timer).toHaveProperty("then");
		expect(typeof timer.then).toBe("function");

		vi.advanceTimersByTime(100);
		await timer;
	});
});

describe("interval", () => {
	it("should be an async iterable", () => {
		const iter = interval(100);
		expect(iter[Symbol.asyncIterator]).toBeDefined();
		expect(iter[Symbol.asyncIterator]()).toBe(iter);
		iter[Symbol.dispose]();
	});

	it("should yield incrementing values on each interval tick", async () => {
		const iter = interval(10);
		const results: number[] = [];

		for await (const value of iter) {
			results.push(value);
			if (results.length >= 3) break;
		}

		iter[Symbol.dispose]();
		expect(results).toEqual([0, 1, 2]);
	});

	it("should be disposable and stop iteration", async () => {
		const iter = interval(10);

		// Wait for at least one tick
		const firstResult = await iter.next();
		expect(firstResult.done).toBe(false);
		expect(typeof firstResult.value).toBe("number");

		iter[Symbol.dispose]();

		const doneResult = await iter.next();
		expect(doneResult).toEqual({ value: undefined, done: true });
	});

	it("should work with using statement", async () => {
		const results: number[] = [];

		{
			using iter = interval(10);

			const result = await iter.next();
			results.push(result.value!);

			const result2 = await iter.next();
			results.push(result2.value!);
		}

		expect(results).toEqual([0, 1]);
	});

	it("should return done when calling return()", async () => {
		const iter = interval(10);

		const firstResult = await iter.next();
		expect(firstResult.done).toBe(false);

		const returnResult = await iter.return!();
		expect(returnResult).toEqual({ value: undefined, done: true });

		// Subsequent calls should also return done
		const nextAfterReturn = await iter.next();
		expect(nextAfterReturn).toEqual({ value: undefined, done: true });
	});

	it("should buffer events up to maxBuffer", async () => {
		const iter = interval(5, { maxBuffer: 3 });

		// Wait for multiple ticks to happen without consuming
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Should have buffered values, starting from recent ones
		const result1 = await iter.next();
		const result2 = await iter.next();
		const result3 = await iter.next();

		// Values should be consecutive and the buffer should have dropped older values
		expect(result1.done).toBe(false);
		expect(result2.done).toBe(false);
		expect(result3.done).toBe(false);
		expect(result2.value).toBe(result1.value! + 1);
		expect(result3.value).toBe(result2.value! + 1);

		iter[Symbol.dispose]();
	});

	it("should respect maxBuffer: 0 (no buffering, only serve waiting consumers)", async () => {
		const iter = interval(10, { maxBuffer: 0 });

		// Wait without consuming - events should be dropped
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Start waiting for next value - should get the next tick after we start waiting
		const result = await iter.next();

		expect(result.done).toBe(false);
		// Value should be > 0 since ticks happened while we weren't waiting
		expect(result.value).toBeGreaterThan(0);

		iter[Symbol.dispose]();
	});

	it("should resolve waiting consumers when disposed", async () => {
		const iter = interval(10000); // Very long interval

		// Start waiting for next value (no tick yet)
		const waitPromise = iter.next();

		// Dispose while waiting
		iter[Symbol.dispose]();

		const result = await waitPromise;
		expect(result).toEqual({ value: undefined, done: true });
	});

	it("should handle multiple waiting consumers correctly", async () => {
		const iter = interval(10);

		// Queue up multiple consumers before ticks
		const promise1 = iter.next();
		const promise2 = iter.next();
		const promise3 = iter.next();

		const [result1, result2, result3] = await Promise.all([
			promise1,
			promise2,
			promise3,
		]);

		// Values should be consecutive
		expect(result1.value).toBe(0);
		expect(result2.value).toBe(1);
		expect(result3.value).toBe(2);

		iter[Symbol.dispose]();
	});

	it("should drain buffered events to waiting consumers", async () => {
		const iter = interval(5, { maxBuffer: 10 });

		// Let some events buffer
		await new Promise((resolve) => setTimeout(resolve, 30));

		// Now request them - they should be available immediately
		const results = await Promise.all([iter.next(), iter.next(), iter.next()]);

		// All should have values and be consecutive
		expect(results.every((r) => !r.done)).toBe(true);
		expect(results[1].value).toBe(results[0].value! + 1);
		expect(results[2].value).toBe(results[1].value! + 1);

		iter[Symbol.dispose]();
	});

	it("should continue iteration after dispose returns done", async () => {
		const iter = interval(100);

		iter[Symbol.dispose]();

		// Multiple calls after dispose should all return done
		const results = await Promise.all([iter.next(), iter.next(), iter.next()]);

		expect(results).toEqual([
			{ value: undefined, done: true },
			{ value: undefined, done: true },
			{ value: undefined, done: true },
		]);
	});

	it("should not emit new events after dispose", async () => {
		const iter = interval(10);

		const first = await iter.next();
		expect(first.done).toBe(false);

		iter[Symbol.dispose]();

		// Wait a bit after dispose
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Should still be done
		const result = await iter.next();
		expect(result.done).toBe(true);
	});
});
