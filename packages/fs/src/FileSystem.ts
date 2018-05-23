import { IDisposableAsync } from '@konstellio/disposable';
import { ReadStream, WriteStream } from "fs";
import { join, normalize, basename, dirname, sep } from 'path';
import { Readable, Writable } from 'stream';

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

const ZeroBuffer = new Buffer(0);

export abstract class FileSystem implements IDisposableAsync {
	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract stat(path: string): Promise<Stats>
	abstract exists(path: string): Promise<boolean>
	abstract unlink(path: string, recursive?: boolean): Promise<void>
	abstract copy(source: string, destination: string): Promise<void>
	abstract rename(oldPath: string, newPath: string): Promise<void>
	abstract readDirectory(path: string): Promise<string[]>
	abstract readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>

	createEmptyFile(path: string): Promise<void> {
		return this.createWriteStream(path)
		.then((stream) => new Promise<void>((resolve, reject) => {
			stream.on('error', (err) => reject(err));
			stream.on('end', () => setTimeout(() => resolve(), 100));
			stream.end(ZeroBuffer);
		}));
	}

	abstract createDirectory(path: string, recursive?: boolean): Promise<void>
	abstract createReadStream(path: string): Promise<Readable>
	abstract createWriteStream(path: string, overwrite?: boolean, encoding?: string): Promise<Writable>
}