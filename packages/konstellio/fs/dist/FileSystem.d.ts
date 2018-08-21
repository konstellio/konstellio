/// <reference types="node" />
import { IDisposableAsync } from '@konstellio/disposable';
import { Readable, Writable } from 'stream';
export declare class Stats {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly isSymbolicLink: boolean;
    readonly size: number;
    readonly atime: Date;
    readonly mtime: Date;
    readonly ctime: Date;
    constructor(isFile: boolean, isDirectory: boolean, isSymbolicLink: boolean, size: number, atime: Date, mtime: Date, ctime: Date);
}
export declare abstract class FileSystem implements IDisposableAsync {
    abstract isDisposed(): boolean;
    abstract disposeAsync(): Promise<void>;
    abstract clone(): FileSystem;
    abstract stat(path: string): Promise<Stats>;
    abstract exists(path: string): Promise<boolean>;
    abstract unlink(path: string, recursive?: boolean): Promise<void>;
    abstract copy(source: string, destination: string): Promise<void>;
    abstract rename(oldPath: string, newPath: string): Promise<void>;
    abstract readDirectory(path: string): Promise<string[]>;
    abstract readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
    createEmptyFile(path: string): Promise<void>;
    abstract createDirectory(path: string, recursive?: boolean): Promise<void>;
    abstract createReadStream(path: string): Promise<Readable>;
    abstract createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
}
export declare class FileSystemMirror extends FileSystem {
    protected readonly fss: FileSystem[];
    private disposed;
    private pool;
    constructor(fss: FileSystem[]);
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    clone(): FileSystemMirror;
    stat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    unlink(path: string, recursive?: boolean): Promise<void>;
    copy(source: string, destination: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    readDirectory(path: string): Promise<string[]>;
    readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
    createDirectory(path: string, recursive?: boolean): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
}
export declare class FileSystemPool extends FileSystem {
    protected readonly fss: FileSystem[];
    private disposed;
    private pool;
    constructor(fss: FileSystem[]);
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    clone(): FileSystemPool;
    stat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    unlink(path: string, recursive?: boolean): Promise<void>;
    copy(source: string, destination: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    readDirectory(path: string): Promise<string[]>;
    readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
    createDirectory(path: string, recursive?: boolean): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
}
