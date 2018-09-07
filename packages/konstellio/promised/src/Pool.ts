import { Deferred } from "./Deferred";
import { IDisposable } from '@konstellio/disposable';

export class Pool<T = any> implements IDisposable {
	private disposed: boolean;
	private waiters: Deferred<T>[];
	private pool: T[];

	constructor(initialObjects?: T[]) {
		this.disposed = false;
		this.waiters = [];
		this.pool = initialObjects ? initialObjects.concat() : [];
	}

	get size() {
		return this.pool.length;
	}
	
	isDisposed() {
		return this.disposed;
	}

	dispose() {
		if (!this.disposed) {
			this.disposed = true;
			for (const waiter of this.waiters) {
				waiter.reject();
			}
			this.waiters = [];
			this.pool = [];
		}
	}

	async acquires(): Promise<T> {
		if (this.pool.length === 0) {
			const defer = new Deferred<T>();
			this.waiters.push(defer);
			return defer.promise;
		}
		return this.pool.shift()!;
	}

	release(obj: T) {
		if (this.waiters.length === 0) {
			this.pool.push(obj);
		} else {
			const w = this.waiters.shift()!;
			w.resolve(obj);
		}
	}

	async *iterate<I, R>(
		iterator: IterableIterator<I> | AsyncIterableIterator<I>,
		callback: (item: I, consumer: T) => R | Promise<R> | IterableIterator<R> | AsyncIterableIterator<R>
	): AsyncIterableIterator<R> {
		const results: R[] = [];
		const workers: Promise<void>[] = [];
		let drained = false;
		while (true) {
			if (drained) {
				break;
			}
			if (this.pool.length) {
				const consumer = await this.acquires();
				const worker = new Promise(async (resolve, reject) => {
					const item = await iterator.next();
					if (item.done) {
						drained = true;
						return resolve();
					}
					const iterable = callback(item.value, consumer);
					if (isAsyncIterable(iterable) || isIterable(iterable)) {
						for await (const result of iterable) {
							results.push(result);
						}
					}
					else if (iterable instanceof Promise) {
						results.push(await iterable);
					}
					else {
						results.push(iterable);
					}
					resolve();
				}).catch(err => { }).then(() => this.release(consumer));
				workers.push(worker);
			}

			for (const result of results.splice(0, results.length)) {
				yield result;
			}

			await wait();
		}
		await Promise.all(workers);
		for (const result of results.splice(0, results.length)) {
			yield result;
		}
	}
}

async function wait(time = 0) {
	return new Promise(resolve => setTimeout(resolve, time));
}

function isAsyncIterable<T>(value: any): value is AsyncIterableIterator<T> {
	return Symbol.asyncIterator in value;
}

function isIterable<T>(value: any): value is IterableIterator<T> {
	return Symbol.iterator in value;
}