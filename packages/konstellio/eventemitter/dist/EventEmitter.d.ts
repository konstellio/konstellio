import { Disposable, IDisposable, IDisposableAsync } from '@konstellio/disposable';
export declare type Handler = (...args: any[]) => void | Promise<any>;
export declare function isEventEmitterInterface(obj: any): boolean;
export interface IEventEmitter {
    on(event: string, handler: Handler): Disposable;
    once(event: string, handler: Handler): Disposable;
    many(event: string, count: number, handler: Handler): Disposable;
    off(event: string, handler?: Handler): void;
    emit(event: string, ...args: any[]): void;
    emitAsync(event: string, ...args: any[]): Promise<any[]>;
}
export declare class EventEmitter implements IDisposable, IDisposableAsync, IEventEmitter {
    private disposable;
    private events;
    constructor();
    isDisposed(): boolean;
    dispose(): void;
    disposeAsync(): Promise<void>;
    on(event: string, handler: Handler): Disposable;
    once(event: string, handler: Handler): Disposable;
    many(event: string, count: number, handler: Handler): Disposable;
    off(event: string, handler?: Handler): void;
    emit(event: string, ...args: any[]): void;
    emitAsync(event: string, ...args: any[]): Promise<any[]>;
}
