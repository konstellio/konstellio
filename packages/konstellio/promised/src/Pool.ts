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

	async consume<I, R>(
		items: IterableIterator<I> | I[],
		callback: (item: I, consumer: T) => undefined | R | Promise<undefined | R>
	) {
		const iterator = items[Symbol.iterator]();
		return new Promise(async (resolve, reject) => {
			const errors: Error[] = [];
			const pending: Promise<any>[] = [];
			while (true) {
				const consumer = await this.acquires();
		
				const item = iterator.next();
				if (item.done) {
					this.release(consumer);
					break;
				}
	
				const running = Promise.resolve(callback(item.value, consumer))
				.catch(err => { errors.push(err); })
				.then(() => { this.release(consumer); });
	
				pending.push(running);
			}
	
			Promise.all(pending).then(() => {
				if (errors.length) {
					return reject(errors[0]);
				}
				resolve();
			});
		});
	}
}