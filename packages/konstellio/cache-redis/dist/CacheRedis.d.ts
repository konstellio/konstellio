import { Cache, Serializable } from '@konstellio/cache';
import { ClientOpts, RedisClient } from 'redis';
export declare class CacheRedis extends Cache {
    protected client: RedisClient;
    protected disposed: boolean;
    constructor(redis_url: string, options?: ClientOpts, clientFactory?: (redis_url: string, options?: ClientOpts) => RedisClient);
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
