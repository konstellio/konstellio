import { RedisClient } from 'redis-mock';
import { Cache, Serializable } from '@konstellio/cache';
export declare class CacheMemory extends Cache {
    protected client: RedisClient;
    protected disposed: boolean;
    constructor();
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    connect(): Promise<this>;
    disconnect(): Promise<void>;
    set(key: string, value: Serializable, ttl: number): Promise<void>;
    expire(key: string, ttl: number): Promise<void>;
    get(key: string): Promise<Serializable>;
    has(key: string): Promise<boolean>;
    unset(key: string): Promise<void>;
}
