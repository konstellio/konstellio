import { IDisposable } from '@konstellio/disposable';
export declare class Gate implements IDisposable {
    private closed;
    private waiters;
    private disposed;
    constructor(closed?: boolean);
    isDisposed(): boolean;
    dispose(): void;
    isOpened(): boolean;
    close(): void;
    open(): void;
    wait(): Promise<void>;
}
