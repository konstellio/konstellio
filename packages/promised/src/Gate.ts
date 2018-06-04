import Deferred from "./Deferred";
import { IDisposable } from '@konstellio/disposable';

export default class Gate implements IDisposable {
	private waiters: Deferred[];
	private disposed: boolean;

	constructor(private closed = true) {
		this.waiters = [];
		this.disposed = false;
	}
	
	isDisposed() {
		return this.disposed;
	}

	dispose() {
		if (this.disposed === false) {
			this.disposed = true;
			this.waiters = [];
		}
	}

	isOpened() {
		return this.closed === false;
	}

	close(): void {
		this.closed = true;
	}

	open(): void {
		this.closed = false;
		for (const waiter of this.waiters) {
			waiter.resolve();
		}
		this.waiters = [];
	}

	async wait(): Promise<void> {
		if (this.closed) {
			const waiter = new Deferred();
			this.waiters.push(waiter);
			return waiter.promise;
		}
	}
}