/// <reference types="node" />
import { FileSystem, Stats } from '@konstellio/fs';
import * as FTPClient from 'ftp';
import { Readable, Writable } from 'stream';
import { ConnectionOptions } from 'tls';
export declare enum FTPConnectionState {
    Disconnecting = 0,
    Closed = 1,
    Connecting = 2,
    Ready = 3
}
export interface FileSystemFTPOptions {
    host?: string;
    port?: number;
    secure?: string | boolean;
    secureOptions?: ConnectionOptions;
    user?: string;
    password?: string;
    connTimeout?: number;
    pasvTimeout?: number;
    keepalive?: number;
    debug?: (msg: string) => void;
}
export declare class FileSystemFTP extends FileSystem {
    private readonly options;
    private disposed;
    private connection?;
    private connectionState;
    private pool;
    constructor(options: FileSystemFTPOptions);
    clone(): FileSystemFTP;
    protected getConnection(): Promise<FTPClient>;
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    stat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    unlink(path: string, recursive?: boolean): Promise<void>;
    copy(): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
    createDirectory(path: string, recursive?: boolean): Promise<void>;
    readDirectory(path: string): Promise<string[]>;
    readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
}
