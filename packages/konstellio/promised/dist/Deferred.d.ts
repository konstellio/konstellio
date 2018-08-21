import { IDisposable } from '@konstellio/disposable';
export declare class Deferred<T = any> implements IDisposable {
    private disposed;
    readonly promise: Promise<T>;
    readonly resolve: (value?: T | Promise<T>) => void;
    readonly reject: (reason?: any) => void;
    constructor();
    isDisposed(): boolean;
    dispose(): void;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Deferred.
     * @param onfulfilled The callback to execute when the Deferred is resolved.
     * @param onrejected The callback to execute when the Deferred is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Deferred.
     * @param onrejected The callback to execute when the Deferred is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
}
