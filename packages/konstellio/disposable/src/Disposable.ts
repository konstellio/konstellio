const isArray = Array.isArray;

export function isDisposableInterface(obj: any): boolean {
	return typeof obj === 'object' && typeof obj.isDisposed === 'function' && typeof obj.dispose === 'function';
}

export interface IDisposable {
	isDisposed(): boolean;
	dispose(): Promise<void>;
}

export class Disposable implements IDisposable {
	protected disposed: boolean = false;

	constructor(private disposable: () => void | Promise<void>) {
		if (typeof disposable !== 'function') {
			throw new TypeError(`Expected a function as disposable, got ${typeof disposable}.`);
		}
	}

	isDisposed() {
		return !!this.disposed;
	}

	async dispose() {
		if (!this.disposed) {
			await this.disposable();
			this.disposed = true;
		}
	}
}

export class CompositeDisposable implements IDisposable {
	protected disposed: boolean = false;

	private disposables: Set<Disposable>;

	constructor(disposables: Set<Disposable> | Disposable[]) {
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

	isDisposed(): boolean {
		return !!this.disposed;
	}

	async dispose() {
		if (!this.disposed) {
			await Promise.all(Array.from(this.disposables.values()).map(disposable => disposable.dispose()));
			this.disposed = true;
		}
	}

	add(...disposables: Disposable[]): void {
		if (!this.disposed) {
			disposables.forEach(disposable => {
				if (!isDisposableInterface(disposable)) {
					throw new TypeError(`Expected a Disposable object, got ${typeof disposable}.`);
				}
				this.disposables.add(disposable);
			});
		}
	}

	remove(disposable: Disposable): void {
		if (!this.disposed) {
			this.disposables.delete(disposable);
		}
	}

	clear(): void {
		if (!this.disposed) {
			this.disposables.clear();
		}
	}
}
