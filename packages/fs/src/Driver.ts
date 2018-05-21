import { IDisposableAsync } from '@konstellio/disposable';
import { ReadStream, WriteStream } from "fs";
import { join, normalize, basename, dirname, sep } from 'path';

export interface Node {
	path: string
	isFile: boolean
	isDirectory: boolean
}

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

export abstract class Driver<F extends File = File, D extends Directory = Directory> implements IDisposableAsync {

	constructor(
		protected readonly fileConstructor: new (driver: Driver<F, D>, path: string) => F,
		protected readonly directoryConstructor: new (driver: Driver<F, D>, path: string) => D
	) {

	}

	file(path: string): F {
		return new this.fileConstructor(this, path);
	}

	directory(path: string): D {
		return new this.directoryConstructor(this, path);
	}

	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
}

export abstract class File<F extends File<any, D> = File<any, any>, D extends Directory<F, any> = Directory<any, any>> implements Node, IDisposableAsync {

	constructor(
		protected readonly driver: Driver<F, D>,
		public readonly path: string
	) {
		this.path = normalize(this.path).split(sep).join('/');
		if (this.path.substr(0, 3) === `../` || this.path === '..') {
			throw new RangeError(`Specified path is trying to reach out of this filesystem.`);
		}
	}

	get isFile(): boolean {
		return true;
	}

	get isDirectory(): boolean {
		return false;
	}

	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract exists(): Promise<boolean>
	abstract unlink(): Promise<boolean>
	abstract copy(destination: string): Promise<File<F, D>>
	abstract rename(newPath: string): Promise<File<F, D>>
	abstract stat(): Promise<Stats>
	abstract createReadStream(): ReadStream
	abstract createWriteStream(): WriteStream
}

export abstract class Directory<F extends File<any, D> = File<any, any>, D extends Directory<F, any> = Directory<any, any>> implements Node, IDisposableAsync {

	constructor(
		protected readonly driver: Driver<F, D>,
		public readonly path: string
	) {
		this.path = normalize(this.path).split(sep).join('/');
		if (this.path.substr(0, 3) === `../` || this.path === '..') {
			throw new RangeError(`Specified path is trying to reach out of this filesystem.`);
		}
	}

	get isFile(): boolean {
		return false;
	}

	get isDirectory(): boolean {
		return true;
	}

	file(path: string): F {
		path = normalize(path);
		return this.driver.file(join(this.path, path));
	}

	directory(path: string): D {
		path = normalize(path);
		return this.driver.directory(join(this.path, path));
	}

	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract exists(): Promise<boolean>
	abstract create(): Promise<boolean>
	abstract unlink(): Promise<boolean>
	abstract rename(newPath: string): Promise<Directory<F, D>>
	abstract readdir(): Promise<(F | D)[]>
}