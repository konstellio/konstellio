import { ReadStream, WriteStream } from "fs";
import { join, normalize, basename, dirname, sep } from 'path';

export abstract class Driver<F extends File<any, D>, D extends Directory<F, any>> {

	protected fileConstructor: new (driver: Driver<F, D>, name: string, parent?: D) => F;
	protected directoryConstructor: new (driver: Driver<F, D>, name: string, parent?: D) => D;
	
	private cache: Map<string, Node<F, D>>;

	constructor() {
		this.cache = new Map<string, Node<F, D>>();
	}

	getFile(path: string): F {
		const fileName: string = basename(path);
		if (fileName === '' || fileName === '.') {
			throw new TypeError(`Expected path "${path}" to have a filename.`);
		}
		return this.get(path) as F;
	}

	getDirectory(path: string): D {
		return this.get(path, true) as D;
	}

	protected get(fullPath: string, asDirectory?: boolean): Node<F, D> {
		fullPath = normalize(fullPath).split(sep).filter(p => p).join('/');

		if (fullPath.substr(0, 3) === `..${sep}` || fullPath === '..') {
			throw new RangeError(`Specified path is trying to reach out of this filesystem.`);
		}
		
		if (this.cache.has(fullPath)) {
			return this.cache.get(fullPath)!;
		}
		
		let parent: D | undefined;
		let node: Node<F, D>;
		
		const parentPath: string = dirname(fullPath);
		if (parentPath !== '.') {
			parent = this.getDirectory(parentPath);
		}
		
		const fileName = basename(fullPath);
		if (!!asDirectory) {
			node = new this.directoryConstructor(this, fileName, parent);
		} else {
			node = new this.fileConstructor(this, fileName, parent)
		}

		this.cache.set(fullPath, node);
		return node;
	}

}

export type Node<F extends File<any, D>, D extends Directory<F, Directory<F, any>>> = F | D;

export abstract class File<F extends File<any, D>, D extends Directory<F, any>> {

	public constructor(
		protected readonly driver: Driver<F, D>,
		public readonly name: string,
		public readonly parent?: D
	) {

	}

	get fullPath(): string {
		return this.parent
			? join(this.parent.fullPath, this.name)
			: this.name;
	}

	toString(): string {
		return this.fullPath;
	}

	abstract exists(): Promise<boolean>
	abstract unlink(): Promise<boolean>
	abstract copy(destination: string): Promise<File<F, D>>
	abstract rename(newPath: string): Promise<File<F, D>>
	abstract stat(): Promise<Stats>
	abstract createReadStream(): ReadStream
	abstract createWriteStream(): WriteStream
}

export abstract class Directory<F extends File<any, D>, D extends Directory<F, any>> {

	public constructor(
		protected readonly driver: Driver<F, D>,
		public readonly name: string,
		public readonly parent?: D
	) {

	}

	get fullPath(): string {
		return this.parent
			? join(this.parent.fullPath, this.name)
			: this.name;
	}

	toString(): string {
		return this.fullPath;
	}

	getFile(path: string): F {
		return this.driver.getFile(join(this.fullPath, path));
	}

	getDirectory(path: string): D {
		return this.driver.getDirectory(join(this.fullPath, path));
	}

	abstract exists(): Promise<boolean>
	abstract create(): Promise<boolean>
	abstract unlink(): Promise<boolean>
	abstract rename(newPath: string): Promise<Directory<F, D>>
	abstract readdir(): Promise<Node<F, D>[]>
}

export class Stats {

	public constructor(
		public readonly size: number,
		public readonly atime: Date,
		public readonly mtime: Date,
		public readonly ctime: Date
	) {

	}

}