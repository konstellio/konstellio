import { Deferred } from "./Deferred";
import { IDisposable } from '@konstellio/disposable';
import { TypedTransformOptions, TypedTransform, TypedTransformCallback } from "./Stream";
import { Transform } from "stream";

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

	transform<I = any, R = any>(
		opts: PoolTransformOptions,
		transform: (chunk: I, consumer: T, push: (chunk: I, encoding?: string) => void) => undefined | R | Promise<undefined | R>
	): TypedTransform<I> {
		const pool = this; // tslint:disable-line
		const workers: Promise<void>[] = [];
		return new Transform({
			...opts,
			async transform(chunk: I, encoding, done: TypedTransformCallback<I>) {
				const transformer = this; // tslint:disable-line
				const consumer = await pool.acquires();
				const worker = new Promise(async (resolve, reject) => {
					await transform(chunk, consumer, transformer.push.bind(transformer));
					resolve();
				}).catch(err => { }).then(() => pool.release(consumer));
				workers.push(worker);
				done();
			},
			async flush(done: TypedTransformCallback<I>) {
				await Promise.all(workers);
				done();
			}
		}) as TypedTransform<I>;
	}
}

export interface PoolTransformOptions {
	highWaterMark?: number;
	encoding?: string;
	objectMode?: boolean;
	decodeStrings?: boolean;
	allowHalfOpen?: boolean;
	readableObjectMode?: boolean;
	writableObjectMode?: boolean;
}