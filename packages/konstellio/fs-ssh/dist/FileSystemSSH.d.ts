/// <reference types="node" />
import { FileSystem, Stats } from '@konstellio/fs';
import { Client } from 'ssh2';
import { Readable, Writable } from 'stream';
export declare enum SSH2ConnectionState {
    Disconnecting = 0,
    Closed = 1,
    Connecting = 2,
    Ready = 3
}
export interface FileSystemSSHAlgorithms {
    kex?: string[];
    cipher?: string[];
    serverHostKey?: string[];
    hmac?: string[];
    compress?: string[];
}
export interface FileSystemSSHOptions {
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
    algorithms?: FileSystemSSHAlgorithms;
    debug?: (information: string) => any;
    sudo?: boolean | string;
}
export declare class FileSystemSSH extends FileSystem {
    protected readonly options: FileSystemSSHOptions;
    private disposed;
    protected connection?: Client;
    protected connectionState: SSH2ConnectionState;
    private pool;
    constructor(options: FileSystemSSHOptions);
    clone(): FileSystemSSH;
    protected getConnection(): Promise<Client>;
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    protected getSudo(): string;
    protected exec(conn: Client, cmd: string): Promise<[number | null, string | undefined, Buffer]>;
    stat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    unlink(path: string, recursive?: boolean): Promise<void>;
    copy(source: string, destination: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
    createDirectory(path: string, recursive?: boolean): Promise<void>;
    readDirectory(path: string): Promise<string[]>;
    readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
}
