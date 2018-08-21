"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isArray = Array.isArray;
function isDisposableInterface(obj) {
    return typeof obj === 'object' &&
        typeof obj.isDisposed === 'function' &&
        typeof obj.dispose === 'function';
}
exports.isDisposableInterface = isDisposableInterface;
class Disposable {
    constructor(disposable) {
        this.disposed = false;
        if (typeof disposable !== 'function') {
            throw new TypeError(`Expected a function as disposable, got ${typeof disposable}.`);
        }
        else {
            this.disposable = disposable;
        }
    }
    isDisposed() {
        return !!this.disposed;
    }
    dispose() {
        this.disposeAsync();
        this.disposed = true;
    }
    disposeAsync() {
        if (this.disposed === true) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            resolve(this.disposable());
        }).then(() => {
            this.disposed = true;
            this.disposable = null;
        });
    }
}
exports.Disposable = Disposable;
class CompositeDisposable {
    constructor(disposables) {
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
    isDisposed() {
        return !!this.disposed;
    }
    dispose() {
        this.disposeAsync();
        this.disposed = true;
    }
    disposeAsync() {
        if (this.disposed === true) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const promises = [];
            this.disposables.forEach((disposable) => {
                promises.push(disposable.disposeAsync());
            });
            resolve(Promise.all(promises).then(() => {
                this.disposed = true;
                this.disposables = null;
            }));
        });
    }
    add(...disposables) {
        if (this.disposed === false) {
            disposables.forEach(disposable => {
                if (isDisposableInterface(disposable) === false) {
                    throw new TypeError(`Expected a Disposable object, got ${typeof disposable}.`);
                }
                this.disposables.add(disposable);
            });
        }
    }
    remove(disposable) {
        if (this.disposed === false) {
            this.disposables.delete(disposable);
        }
    }
    clear() {
        if (this.disposed === false) {
            this.disposables.clear();
        }
    }
}
exports.CompositeDisposable = CompositeDisposable;
//# sourceMappingURL=Disposable.js.map