export declare function isDisposableInterface(obj: any): boolean;
export interface IDisposable {
    isDisposed(): boolean;
    dispose(): void;
}
export interface IDisposableAsync {
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
}
export declare class Disposable implements IDisposable, IDisposableAsync {
    protected disposed: boolean;
    private disposable;
    constructor(disposable?: () => void);
    isDisposed(): boolean;
    dispose(): void;
    disposeAsync(): Promise<void>;
}
export declare class CompositeDisposable implements IDisposable, IDisposableAsync {
    protected disposed: boolean;
    private disposables;
    constructor(disposables?: Set<Disposable> | Disposable[]);
    isDisposed(): boolean;
    dispose(): void;
    disposeAsync(): Promise<void>;
    add(...disposables: Disposable[]): void;
    remove(disposable: Disposable): void;
    clear(): void;
}
