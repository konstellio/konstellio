/// <reference types="node" />
import { Readable, Writable } from 'stream';
import { FileSystem, Stats } from '@konstellio/fs';
export declare class FileSystemLocal extends FileSystem {
    readonly rootDirectory: string;
    readonly directoryMode: number;
    readonly fileMode: number;
    private disposed;
    constructor(rootDirectory: string, directoryMode?: number, fileMode?: number);
    isDisposed(): boolean;
    disposeAsync(): Promise<void>;
    clone(): FileSystemLocal;
    stat(path: string): Promise<Stats>;
    exists(path: string): Promise<boolean>;
    unlink(path: string, recursive?: boolean): Promise<void>;
    copy(source: string, destination: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    createReadStream(path: string): Promise<Readable>;
    createWriteStream(path: string, overwrite?: boolean, encoding?: string): Promise<Writable>;
    createDirectory(path: string, recursive?: boolean): Promise<void>;
    readDirectory(path: string): Promise<string[]>;
    readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
}
