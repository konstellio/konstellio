import * as assert from 'assert';
import { IDisposableAsync } from '@konstellio/disposable';
import { Readable, Writable, Transform } from 'stream';
import { Pool } from '@konstellio/promised';

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

const ZeroBuffer = Buffer.alloc(0);

export abstract class FileSystem implements IDisposableAsync {
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

	createEmptyFile(path: string): Promise<void> {
		return this.createWriteStream(path)
		.then((stream) => new Promise<void>((resolve, reject) => {
			stream.on('error', (err) => reject(err));
			stream.on('end', () => setTimeout(() => resolve(), 100));
			stream.end(ZeroBuffer);
		}));
	}

	abstract createDirectory(path: string, recursive?: boolean): Promise<void>;
	abstract createReadStream(path: string): Promise<Readable>;
	abstract createWriteStream(path: string, overwrite?: boolean): Promise<Writable>;
}

export class FileSystemMirror extends FileSystem {

	private disposed: boolean;
	private pool: Pool<FileSystem>;

	constructor(protected readonly fss: FileSystem[]) {
		super();
		assert(fss.length > 1, `Expected at least two file system.`);
		this.disposed = false;
		this.pool = new Pool(fss);
	}

	isDisposed() {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		if (!this.isDisposed()) {
			this.disposed = true;
			this.pool.dispose();
			(this as any).fss = [];
			(this as any).pool = undefined;
		}
	}

	clone() {
		return new FileSystemMirror(this.fss);
	}

	async stat(path: string): Promise<Stats> {
		const fs = await this.pool.acquires();
		const stat = await fs.stat(path);
		this.pool.release(fs);
		return stat;
	}

	async exists(path: string): Promise<boolean> {
		const fs = await this.pool.acquires();
		const exists = await fs.exists(path);
		this.pool.release(fs);
		return exists;
	}

	unlink(path: string, recursive?: boolean): Promise<void> {
		return Promise.all(this.fss.map(fs => fs.unlink(path, recursive))).then(() => {});
	}

	copy(source: string, destination: string): Promise<void> {
		return Promise.all(this.fss.map(fs => fs.copy(source, destination))).then(() => {});
	}

	rename(oldPath: string, newPath: string): Promise<void> {
		return Promise.all(this.fss.map(fs => fs.copy(oldPath, newPath))).then(() => {});
	}

	async readDirectory(path: string): Promise<string[]>;
	async readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
	async readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		const fs = await this.pool.acquires();
		const entries = await fs.readDirectory(path, stat === true);
		this.pool.release(fs);
		return entries;
	}
	
	createDirectory(path: string, recursive?: boolean): Promise<void> {
		return Promise.all(this.fss.map(fs => fs.createDirectory(path, recursive))).then(() => {});
	}

	async createReadStream(path: string): Promise<Readable> {
		const fs = await this.pool.acquires();
		const stream = await fs.createReadStream(path);
		stream.on('end', () => this.pool.release(fs));
		stream.on('error', () => this.pool.release(fs));
		return stream;
	}

	async createWriteStream(path: string, overwrite?: boolean): Promise<Writable> {
		const stream = new Transform({
			transform(chunk, _, done) {
				this.push(chunk);
				done();
			}
		});

		for (const fs of this.fss) {
			const writeStream = await fs.createWriteStream(path, overwrite);
			stream.pipe(writeStream);
		}

		return stream;
	}

}

export class FileSystemPool extends FileSystem {
	private disposed: boolean;
	private pool: Pool<FileSystem>;

	constructor(protected readonly fss: FileSystem[]) {
		super();
		assert(fss.length > 0, `Expected at least one file system.`);
		this.disposed = false;
		this.pool = new Pool(fss);
	}

	isDisposed() {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		if (!this.isDisposed()) {
			this.disposed = true;
			this.pool.dispose();
			(this as any).fss = [];
			(this as any).pool = undefined;
		}
	}

	clone() {
		return new FileSystemPool(this.fss);
	}

	async stat(path: string): Promise<Stats> {
		const fs = await this.pool.acquires();
		try {
			const stat = await fs.stat(path);
			this.pool.release(fs);
			return stat;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async exists(path: string): Promise<boolean> {
		const fs = await this.pool.acquires();
		try {
			const exists = await fs.exists(path);
			this.pool.release(fs);
			return exists;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async unlink(path: string, recursive?: boolean): Promise<void> {
		const fs = await this.pool.acquires();
		try {
			const unlink = await fs.unlink(path, recursive);
			this.pool.release(fs);
			return unlink;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		const fs = await this.pool.acquires();
		try {
			const copy = await fs.copy(source, destination);
			this.pool.release(fs);
			return copy;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const fs = await this.pool.acquires();
		try {
			const rename = await fs.rename(oldPath, newPath);
			this.pool.release(fs);
			return rename;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async readDirectory(path: string): Promise<string[]>;
	async readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
	async readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		const fs = await this.pool.acquires();
		try {
			const entries = await fs.readDirectory(path, stat === true);
			this.pool.release(fs);
			return entries;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}
	
	async createDirectory(path: string, recursive?: boolean): Promise<void> {
		const fs = await this.pool.acquires();
		try {
			const mkdir = await fs.createDirectory(path, recursive);
			this.pool.release(fs);
			return mkdir;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async createReadStream(path: string): Promise<Readable> {
		const fs = await this.pool.acquires();
		try {
			const stream = await fs.createReadStream(path);
			stream.on('end', () => this.pool.release(fs));
			stream.on('error', () => this.pool.release(fs));
			return stream;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}

	async createWriteStream(path: string, overwrite?: boolean): Promise<Writable> {
		const fs = await this.pool.acquires();
		try {
			const stream = await fs.createWriteStream(path, overwrite);
			stream.on('finish', () => this.pool.release(fs));
			stream.on('error', () => this.pool.release(fs));
			return stream;
		} catch (err) {
			this.pool.release(fs);
			throw err;
		}
	}
}