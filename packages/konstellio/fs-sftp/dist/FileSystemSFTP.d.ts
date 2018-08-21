/// <reference types="node" />
import { FileSystem, Stats } from '@konstellio/fs';
import { Client, SFTPWrapper } from 'ssh2';
import { Readable, Writable } from 'stream';
export declare enum SFTPConnectionState {
    Disconnecting = 0,
    Closed = 1,
    Connecting = 2,
    Ready = 3
}
export interface FileSystemSFTPAlgorithms {
    kex?: string[];
    cipher?: string[];
    serverHostKey?: string[];
    hmac?: string[];
    compress?: string[];
}
export interface FileSystemSFTPOptions {
    host?: string;
    port?: number;
    forceIPv4?: boolean;
    forceIPv6?: boolean;
    hostHash?: "md5" | "sha1";
    hostVerifier?: (keyHash: string) => boolean;
    username?: string;
    password?: string;
    agent?: string;
    privateKey?: Buffer | string;
    passphrase?: string;
    localHostname?: string;
    localUsername?: string;
    tryKeyboard?: boolean;
    keepaliveInterval?: number;
    keepaliveCountMax?: number;
    readyTimeout?: number;
    strictVendor?: boolean;
    sock?: NodeJS.ReadableStream;
    agentForward?: boolean;
    algorithms?: FileSystemSFTPAlgorithms;
    debug?: (information: string) => any;
}
export declare class FileSystemSFTP extends FileSystem {
    protected readonly options: FileSystemSFTPOptions;
    private disposed;
    protected connection?: Client;
    protected connectionState: SFTPConnectionState;
    protected sftp?: SFTPWrapper;
    private pool;
    constructor(options: FileSystemSFTPOptions);
    clone(): FileSystemSFTP;
    protected getConnection(): Promise<[Client, SFTPWrapper]>;
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    stat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    unlink(path: string): Promise<void>;
    copy(): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
    createDirectory(path: string): Promise<void>;
    readDirectory(path: string): Promise<string[]>;
    readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
}
