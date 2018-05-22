import { IDisposableAsync } from '@konstellio/disposable';
import { ReadStream, WriteStream } from "fs";
import { join, normalize, basename, dirname, sep } from 'path';

export class Stats {

	public constructor(
		public readonly isFile: boolean,
		public readonly isDirectory: boolean,
		public readonly isSymbolicLink: boolean,
		public readonly size: number,
		public readonly atime: Date,
		public readonly mtime: Date,
		public readonly ctime: Date
	) {

	}

}

export abstract class Driver implements IDisposableAsync {
	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract stat(path: string): Promise<Stats>
	abstract exists(path: string): Promise<boolean>
	abstract unlink(path: string, recursive?: boolean): Promise<void>
	abstract copy(source: string, destination: string): Promise<void>
	abstract rename(oldPath: string, newPath: string): Promise<void>
	abstract readDirectory(path: string): Promise<string[]>
	abstract readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>
	abstract createFile(path: string, recursive?: boolean): Promise<void>
	abstract createDirectory(path: string, recursive?: boolean): Promise<void>
	abstract createReadStream(path: string): ReadStream
	abstract createWriteStream(path: string, overwrite?: boolean, encoding?: string): WriteStream
}