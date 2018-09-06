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
		iterator: AsyncIterableIterator<I> | IterableIterator<I>,
		callback: (item: I, consumer: T) => R | Promise<R>
	): AsyncIterableIterator<R> {
		const yieldResults: R[] = [];
		const pending: Promise<void>[] = [];
		while (true) {
			const consumer = await this.acquires();
			for (const result of yieldResults.splice(0, yieldResults.length)) {
				yield result;
			}

			const item = await iterator.next();
			if (item.done) {
				this.release(consumer);
				break;
			}

			const promise = Promise.resolve(callback(item.value, consumer))
			.then(result => yieldResults.push(result))
			.catch(err => {})
			.then(() => this.release(consumer));

			pending.push(promise);
		}
		await Promise.all(pending);
		for (const result of yieldResults.splice(0, yieldResults.length)) {
			yield result;
		}
	}
}