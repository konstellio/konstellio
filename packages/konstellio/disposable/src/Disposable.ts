const isArray = Array.isArray;

export function isDisposableInterface (obj: any): boolean {
	return typeof obj === 'object' && 
		typeof obj.isDisposed === 'function' &&
		typeof obj.dispose === 'function';
}

export interface IDisposable {
	isDisposed (): boolean;
	dispose (): void;
}

export interface IDisposableAsync {
	isDisposed (): boolean;
	disposeAsync (): Promise<void>;
}

export class Disposable implements IDisposable, IDisposableAsync {

	protected disposed: boolean;
	private disposable: (() => void) | null;

	constructor (disposable?: () => void) {
		this.disposed = false;
		if (typeof disposable !== 'function') {
			throw new TypeError(`Expected a function as disposable, got ${typeof disposable}.`);
		}
		else {
			this.disposable = disposable;
		}
	}

	isDisposed (): boolean {
		return !!this.disposed;
	}

	dispose (): void {
		this.disposeAsync();
		this.disposed = true;
	}

	disposeAsync (): Promise<void> {
		if (this.disposed) {
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			resolve((<() => void>this.disposable)());
		}).then(() => {
			this.disposed = true;
			this.disposable = null;
		});
	}

}

export class CompositeDisposable implements IDisposable, IDisposableAsync {

	protected disposed: boolean;
	private disposables: Set<Disposable> | null;

	constructor (disposables?: Set<Disposable> | Disposable[]) {
		this.disposed = false;
		if (disposables) {
			if (!(disposables instanceof Set) && !isArray(disposables)) {
				throw new TypeError(`Expected "disposables" argument to be an array or Set, got ${typeof disposables}.`);
			}
			Array.from(disposables).forEach(disposable => {
				if (!isDisposableInterface(disposable)) {
					throw new TypeError(`Expected a Disposable object, got ${typeof disposable}.`);
				}
			});
			this.disposables = new Set(disposables);
		}
		else {
			this.disposables = new Set();
		}
	}

	isDisposed (): boolean {
		return !!this.disposed;
	}

	dispose (): void {
		this.disposeAsync();
		this.disposed = true;
	}

	disposeAsync (): Promise<void> {
		if (this.disposed) {
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			const promises: Promise<void>[] = [];
			(<Set<Disposable>>this.disposables).forEach((disposable) => {
				promises.push(disposable.disposeAsync());
			});
			resolve(Promise.all<void>(promises).then(() => {
				this.disposed = true;
				this.disposables = null;
			}));
		});
	}

	add (...disposables: Disposable[]): void {
		if (!this.disposed) {
			disposables.forEach(disposable => {
				if (!isDisposableInterface(disposable)) {
					throw new TypeError(`Expected a Disposable object, got ${typeof disposable}.`);
				}
				(<Set<Disposable>>this.disposables).add(disposable);
			});
		}
	}

	remove (disposable: Disposable): void {
		if (!this.disposed) {
			(<Set<Disposable>>this.disposables).delete(disposable);
		}
	}

	clear (): void {
		if (!this.disposed) {
			(<Set<Disposable>>this.disposables).clear();
		}
	}
}