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
}