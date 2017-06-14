const isArray = Array.isArray;

export function isDisposableInterface (obj: any): boolean {
	return typeof obj === 'object' && 
		typeof obj.isDisposed === 'function' &&
		typeof obj.dispose === 'function';
}

export interface IDisposable {
	isDisposed (): boolean
	dispose (): void
}

export class Disposable implements IDisposable {

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
		if (this.disposed === false) {
			(<() => void>this.disposable)();
			this.disposed = true;
			this.disposable = null;
		}
	}

}

export class CompositeDisposable implements IDisposable {

	protected disposed: boolean;
	private disposables: Set<Disposable> | null;

	constructor (disposables?: Set<Disposable> | Disposable[]) {
		this.disposed = false;
		if (disposables) {
			if ((disposables instanceof Set) === false && isArray(disposables) === false) {
				throw new TypeError(`Expected "disposables" argument to be an array or Set, got ${typeof disposables}.`);
			}
			Array.from(disposables).forEach(disposable => {
				if (isDisposableInterface(disposable) === false) {
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
		if (this.disposed === false) {
			(<Set<Disposable>>this.disposables).forEach((disposable, key, set) => {
				disposable.dispose();
			});
			this.disposed = true;
			this.disposables = null;
		}
	}

	add (...disposables: Disposable[]): void {
		if (this.disposed === false) {
			disposables.forEach(disposable => {
				if (isDisposableInterface(disposable) === false) {
					throw new TypeError(`Expected a Disposable object, got ${typeof disposable}.`);
				}
				(<Set<Disposable>>this.disposables).add(disposable);
			});
		}
	}

	remove (disposable: Disposable): void {
		if (this.disposed === false) {
			(<Set<Disposable>>this.disposables).delete(disposable);
		}
	}

	clear (): void {
		if (this.disposed === false) {
			(<Set<Disposable>>this.disposables).clear();
		}
	}
}