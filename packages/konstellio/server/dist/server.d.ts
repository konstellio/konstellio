import { Driver as CacheDriver } from '@konstellio/cache';
import { Driver as DBDriver } from '@konstellio/db';
import { FileSystem } from '@konstellio/fs';
import { Driver as MQDriver } from '@konstellio/mq';
import { IDisposableAsync } from '@konstellio/disposable';
import { Config } from './utilities/config';
import { Plugin } from './plugin';
export declare enum ServerListenMode {
    All = 3,
    Graphql = 1,
    Websocket = 2,
    Worker = 6
}
export interface ServerListenOptions {
    skipMigration?: boolean;
    mode?: ServerListenMode;
}
export interface ServerListenStatus {
    mode: ServerListenMode;
    family?: string;
    address?: string;
    port?: number;
}
export declare function createServer(config: Config): Promise<Server>;
export declare class Server implements IDisposableAsync {
    readonly config: Config;
    readonly database: DBDriver;
    readonly fs: FileSystem;
    readonly cache: CacheDriver;
    readonly mq: MQDriver;
    private disposed;
    private plugins;
    private server;
    constructor(config: Config, database: DBDriver, fs: FileSystem, cache: CacheDriver, mq: MQDriver);
    disposeAsync(): Promise<void>;
    isDisposed(): boolean;
    register(plugin: Plugin): void;
    listen({ skipMigration, mode }?: ServerListenOptions): Promise<ServerListenStatus>;
}
