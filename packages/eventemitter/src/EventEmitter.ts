import { Disposable, IDisposable, IDisposableAsync, CompositeDisposable } from '@konstellio/disposable';

export type Handler = (...args: any[]) => void | Promise<any>;

export function isEventEmitterInterface (obj: any): boolean {
	return typeof obj === 'object' &&
		typeof obj.on === 'function' &&
		typeof obj.once === 'function' &&
		typeof obj.many === 'function' &&
		typeof obj.off === 'function' &&
		typeof obj.emit === 'function' &&
		typeof obj.emitAsync === 'function';
}

export interface IEventEmitter {
	on (event: string, handler: Handler): Disposable;
	once (event: string, handler: Handler): Disposable;
	many (event: string, count: number, handler: Handler): Disposable;
	off (event: string, handler?: Handler): void;
	emit (event: string, ...args: any[]): void;
	emitAsync (event: string, ...args: any[]): Promise<any[]>;
}

export class EventEmitter implements IDisposable, IDisposableAsync, IEventEmitter {

	private disposable: CompositeDisposable | null;
	private events: Map<string, Set<Handler>> | null;

	constructor () {
		this.disposable = new CompositeDisposable();
		this.events = new Map<string, Set<Handler>>();
	}

	isDisposed (): boolean {
		return this.disposable == null || this.disposable.isDisposed();
	}

	dispose (): void {
		if (this.isDisposed() === false) {
			(<CompositeDisposable>this.disposable).dispose();
			this.disposable = null;
			this.events = null;
		}
	}

	disposeAsync (): Promise<void> {
		if (this.isDisposed() === true) {
			return Promise.resolve();
		}
		return (<CompositeDisposable>this.disposable).disposeAsync().then(() => {
			this.disposable = null;
			this.events = null;
		});
	}

	on (event: string, handler: Handler): Disposable {
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
		(<CompositeDisposable>this.disposable).add(disposable);

		if ((<Map<string, Set<Handler>>>this.events).has(event) === false) {
			(<Map<string, Set<Handler>>>this.events).set(event, new Set<Handler>());
		}
		const handlers = (<Map<string, Set<Handler>>>this.events).get(event);
		(<Set<Handler>>handlers).add(handler);

		return disposable;
	}

	once (event: string, handler: Handler): Disposable {
		return this.many(event, 1, handler);
	}

	many (event: string, count: number, handler: Handler): Disposable {
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
		}
		const disposable = this.on(event, proxyHandler);
		return disposable;
	}

	off (event: string, handler?: Handler): void {
		if (this.isDisposed()) {
			throw new Error(`EventEmitter is disposed and thus no more enabled.`);
		}
		if (typeof event !== 'string') {
			throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
		}
		if (handler != null && typeof handler !== 'function') {
			throw new TypeError(`Expected handler to be a function, got ${typeof handler}.`);
		}
		const handlers = (<Map<string, Set<Handler>>>this.events).get(event);
		if (handlers) {
			if (handler) {
				handlers.delete(handler);
				if (handlers.size === 0) {
					(<Map<string, Set<Handler>>>this.events).delete(event);
				}
			}
			else {
				handlers.clear();
				(<Map<string, Set<Handler>>>this.events).delete(event);
			}
		}
	}

	emit (event: string, ...args: any[]): void {
		if (this.isDisposed()) {
			throw new Error(`EventEmitter is disposed and thus no more enabled.`);
		}
		if (typeof event !== 'string') {
			throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
		}
		const regex = new RegExp(event, '');
		const handlers: Handler[] = [];
		for (let e of (<Map<string, Set<Handler>>>this.events).keys()) {
			if (regex.test(e)) {
				const eventHandlers = (<Map<string, Set<Handler>>>this.events).get(e);
				(<Set<Handler>>eventHandlers).forEach(handler => handlers.push(handler));
			}
		}
		handlers.forEach(handler => handler(...args));
	}

	emitAsync (event: string, ...args: any[]): Promise<any[]> {
		if (this.isDisposed()) {
			return Promise.reject(new Error(`EventEmitter is disposed and thus no more enabled.`));
		}
		if (typeof event !== 'string') {
			return Promise.reject(new TypeError(`Expected event argument to be a string, got ${typeof event}.`));
		}
		const regex = new RegExp(event, 'i');
		const handlers: Handler[] = [];
		for (let e of (<Map<string, Set<Handler>>>this.events).keys()) {
			if (regex.test(e)) {
				const eventHandlers = (<Map<string, Set<Handler>>>this.events).get(e);
				(<Set<Handler>>eventHandlers).forEach(handler => handlers.push(handler));
			}
		}
		return Promise.all(handlers.map(handler => handler(...args)));
	}
}