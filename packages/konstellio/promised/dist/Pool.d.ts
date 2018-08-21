import { IDisposable } from '@konstellio/disposable';
export declare class Pool<T = any> implements IDisposable {
    private disposed;
    private waiters;
    private pool;
    constructor(initialObjects?: T[]);
    isDisposed(): boolean;
    dispose(): void;
    acquires(): Promise<T>;
    release(obj: T): void;
}
