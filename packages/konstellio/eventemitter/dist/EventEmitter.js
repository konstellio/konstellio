"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const disposable_1 = require("@konstellio/disposable");
function isEventEmitterInterface(obj) {
    return typeof obj === 'object' &&
        typeof obj.on === 'function' &&
        typeof obj.once === 'function' &&
        typeof obj.many === 'function' &&
        typeof obj.off === 'function' &&
        typeof obj.emit === 'function' &&
        typeof obj.emitAsync === 'function';
}
exports.isEventEmitterInterface = isEventEmitterInterface;
class EventEmitter {
    constructor() {
        this.disposable = new disposable_1.CompositeDisposable();
        this.events = new Map();
    }
    isDisposed() {
        return this.disposable == null || this.disposable.isDisposed();
    }
    dispose() {
        if (this.isDisposed() === false) {
            this.disposable.dispose();
            this.disposable = null;
            this.events = null;
        }
    }
    disposeAsync() {
        if (this.isDisposed() === true) {
            return Promise.resolve();
        }
        return this.disposable.disposeAsync().then(() => {
            this.disposable = null;
            this.events = null;
        });
    }
    on(event, handler) {
        if (this.isDisposed()) {
            throw new Error(`EventEmitter is disposed and thus no more enabled.`);
        }
        if (typeof event !== 'string') {
            throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
        }
        if (typeof handler !== 'function') {
            throw new TypeError(`Expected handler argument to be a function, got ${typeof handler}.`);
        }
        const disposable = new disposable_1.Disposable(() => this.off(event, handler));
        this.disposable.add(disposable);
        if (this.events.has(event) === false) {
            this.events.set(event, new Set());
        }
        const handlers = this.events.get(event);
        handlers.add(handler);
        return disposable;
    }
    once(event, handler) {
        return this.many(event, 1, handler);
    }
    many(event, count, handler) {
        if (typeof count !== 'number') {
            throw new TypeError(`Expected count argument to be a number, got ${typeof count}.`);
        }
        if (typeof handler !== 'function') {
            throw new TypeError(`Expected handler argument to be a function, got ${typeof handler}.`);
        }
        const proxyHandler = (...args) => {
            handler(...args);
            if (--count <= 0) {
                disposable.dispose();
            }
        };
        const disposable = this.on(event, proxyHandler);
        return disposable;
    }
    off(event, handler) {
        if (this.isDisposed()) {
            throw new Error(`EventEmitter is disposed and thus no more enabled.`);
        }
        if (typeof event !== 'string') {
            throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
        }
        if (handler != null && typeof handler !== 'function') {
            throw new TypeError(`Expected handler to be a function, got ${typeof handler}.`);
        }
        const handlers = this.events.get(event);
        if (handlers) {
            if (handler) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.events.delete(event);
                }
            }
            else {
                handlers.clear();
                this.events.delete(event);
            }
        }
    }
    emit(event, ...args) {
        if (this.isDisposed()) {
            throw new Error(`EventEmitter is disposed and thus no more enabled.`);
        }
        if (typeof event !== 'string') {
            throw new TypeError(`Expected event argument to be a string, got ${typeof event}.`);
        }
        const regex = new RegExp(event, '');
        const handlers = [];
        for (let e of this.events.keys()) {
            if (regex.test(e)) {
                const eventHandlers = this.events.get(e);
                eventHandlers.forEach(handler => handlers.push(handler));
            }
        }
        handlers.forEach(handler => handler(...args));
    }
    emitAsync(event, ...args) {
        if (this.isDisposed()) {
            return Promise.reject(new Error(`EventEmitter is disposed and thus no more enabled.`));
        }
        if (typeof event !== 'string') {
            return Promise.reject(new TypeError(`Expected event argument to be a string, got ${typeof event}.`));
        }
        const regex = new RegExp(event, 'i');
        const handlers = [];
        for (let e of this.events.keys()) {
            if (regex.test(e)) {
                const eventHandlers = this.events.get(e);
                eventHandlers.forEach(handler => handlers.push(handler));
            }
        }
        return Promise.all(handlers.map(handler => handler(...args)));
    }
}
exports.EventEmitter = EventEmitter;
//# sourceMappingURL=EventEmitter.js.map