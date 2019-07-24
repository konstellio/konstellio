import { Disposable, IDisposable, CompositeDisposable } from '@konstellio/disposable';

export type Handler = (...args: any[]) => void | Promise<any>;

export function isEventEmitterInterface(obj: any): boolean {
	return (
		typeof obj === 'object' &&
		typeof obj.on === 'function' &&
		typeof obj.once === 'function' &&
		typeof obj.many === 'function' &&
		typeof obj.off === 'function' &&
		typeof obj.emit === 'function' &&
		typeof obj.emitAsync === 'function'
	);
}

export interface IEventEmitter {
	on(event: string, handler: Handler): Disposable;
	once(event: string, handler: Handler): Disposable;
	many(event: string, count: number, handler: Handler): Disposable;
	off(event: string, handler?: Handler): void;
	emit(event: string, ...args: any[]): void;
	emitAsync(event: string, ...args: any[]): Promise<any[]>;
}

export class EventEmitter implements IDisposable, IEventEmitter {
	private disposable: CompositeDisposable = new CompositeDisposable([]);
	private events: Map<string, Set<Handler>> = new Map();

	constructor() {}

	isDisposed(): boolean {
		return this.disposable.isDisposed();
	}

	async dispose() {
		if (!this.isDisposed()) {
			await this.disposable.dispose();
			this.events.clear();
		}
	}

	on(event: string, handler: Handler): Disposable {
		if (this.isDisposed()) {
			throw new Error(`EventEmitter is disposed and thus no more enabled.`);
		}
		if (typeof event !== 'string') {
			throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
		}
		if (typeof handler !== 'function') {
			throw new TypeError(`Expected handler argument to be a function, got ${typeof handler}.`);
		}
		const disposable = new Disposable(() => this.off(event, handler));
		this.disposable.add(disposable);

		if (!this.events.has(event)) {
			this.events.set(event, new Set<Handler>());
		}
		const handlers = this.events.get(event)!;
		handlers.add(handler);

		return disposable;
	}

	once(event: string, handler: Handler): Disposable {
		return this.many(event, 1, handler);
	}

	many(event: string, count: number, handler: Handler): Disposable {
		if (typeof count !== 'number') {
			throw new TypeError(`Expected count argument to be a number, got ${typeof count}.`);
		}
		if (typeof handler !== 'function') {
			throw new TypeError(`Expected handler argument to be a function, got ${typeof handler}.`);
		}
		const proxyHandler: Handler = (...args: any[]) => {
			handler(...args);
			if (--count <= 0) {
				disposable.dispose();
			}
		};
		const disposable = this.on(event, proxyHandler);
		return disposable;
	}

	off(event: string, handler?: Handler): void {
		if (this.isDisposed()) {
			throw new Error(`EventEmitter is disposed and thus no more enabled.`);
		}
		if (typeof event !== 'string') {
			throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
		}
		if (handler !== null && typeof handler !== 'function') {
			throw new TypeError(`Expected handler to be a function, got ${typeof handler}.`);
		}
		const handlers = this.events.get(event);
		if (handlers) {
			if (handler) {
				handlers.delete(handler);
				if (handlers.size === 0) {
					this.events.delete(event);
				}
			} else {
				handlers.clear();
				this.events.delete(event);
			}
		}
	}

	emit(event: string, ...args: any[]): void {
		if (this.isDisposed()) {
			throw new Error(`EventEmitter is disposed and thus no more enabled.`);
		}
		if (typeof event !== 'string') {
			throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
		}
		const regex = new RegExp(event, '');
		const handlers: Handler[] = [];
		for (const e of this.events.keys()) {
			if (regex.test(e)) {
				const eventHandlers = this.events.get(e)!;
				eventHandlers.forEach(handler => handlers.push(handler));
			}
		}
		handlers.forEach(handler => handler(...args));
	}

	emitAsync(event: string, ...args: any[]): Promise<any[]> {
		if (this.isDisposed()) {
			return Promise.reject(new Error(`EventEmitter is disposed and thus no more enabled.`));
		}
		if (typeof event !== 'string') {
			return Promise.reject(new TypeError(`Expected event argument to be a string, got ${typeof event}.`));
		}
		const regex = new RegExp(event, 'i');
		const handlers: Handler[] = [];
		for (const e of this.events.keys()) {
			if (regex.test(e)) {
				const eventHandlers = this.events.get(e)!;
				eventHandlers.forEach(handler => handlers.push(handler));
			}
		}
		return Promise.all(handlers.map(handler => handler(...args)));
	}
}
