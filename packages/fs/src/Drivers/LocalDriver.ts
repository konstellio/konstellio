import { exists, unlink, lstat, mkdir, rename, copyFile, createReadStream, createWriteStream, ReadStream, WriteStream, readdir } from 'fs';
import { join, normalize, basename, dirname } from 'path';
import { Driver, File, Directory, Stats } from '../Driver';

export class LocalDriver extends Driver<LocalFile, LocalDirectory> {
	protected disposed: boolean

	public constructor(
		public readonly rootDirectory: string,
		public readonly directoryMode = 0o777,
		public readonly fileMode = 0o644,
		public readonly encoding = 'utf8'
	) {
		super(LocalFile, LocalDirectory);
		this.rootDirectory = normalize(this.rootDirectory);
		this.disposed = false;
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	disposeAsync(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.disposed === false) {
				this.rootDirectory! = undefined!;
				this.disposed = true;
			}
		});
	}
}

export class LocalFile extends File<LocalFile, LocalDirectory> {
	protected disposed: boolean

	constructor(
		protected readonly driver: LocalDriver,
		public readonly path: string
	) {
		super(driver, path);
		this.disposed = false;
	}

	get realPath(): string {
		return join(this.driver.rootDirectory, this.path);
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	disposeAsync(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.disposed === false) {
				this.disposed = true;
			}
		});
	}

	exists(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			exists(this.realPath, exists => resolve(exists));
		});
	}

	unlink(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			unlink(this.realPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(true);
			});
		});
	}

	copy(destPath: string): Promise<LocalFile> {
		destPath = normalize(destPath);
		const realPath = join(this.driver.rootDirectory, destPath);
		return new Promise((resolve, reject) => {
			copyFile(this.realPath, realPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(this.driver.file(destPath));
			});
		});
	}

	rename(newPath: string): Promise<LocalFile> {
		newPath = normalize(newPath);
		const realPath = join(this.driver.rootDirectory, newPath);
		return new Promise((resolve, reject) => {
			rename(this.realPath, realPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(this.driver.file(newPath));
			});
		});
	}

	stat(): Promise<Stats> {
		return new Promise((resolve, reject) => {
			lstat(this.realPath, (err, stats) => {
				if (err) {
					return reject(err);
				}
				resolve(new Stats(
					stats.size,
					stats.atime,
					stats.mtime,
					stats.ctime
				));
			});
		});
	}

	createReadStream(): ReadStream {
		return createReadStream(
			this.realPath
		);
	}

	createWriteStream(): WriteStream {
		return createWriteStream(
			this.realPath,
			{
				mode: this.driver.fileMode,
				encoding: this.driver.encoding,
				autoClose: true
			}
		);
	}
}

export class LocalDirectory extends Directory<LocalFile, LocalDirectory> {
	protected disposed: boolean

	constructor(
		protected readonly driver: LocalDriver,
		public readonly path: string
	) {
		super(driver, path);
		this.disposed = false;
	}

	get realPath(): string {
		return join(this.driver.rootDirectory, this.path);
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	disposeAsync(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.disposed === false) {
				this.disposed = true;
			}
		});
	}

	exists(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			exists(this.realPath, exists => resolve(exists));
		});
	}

	create(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			mkdir(
				this.realPath,
				this.driver.directoryMode,
				err => {
					if (err) {
						return reject(err);
					}
					resolve(true);
				}
			);
		});
	}

	unlink(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			unlink(this.realPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(true);
			});
		});
	}

	rename(newPath: string): Promise<LocalDirectory> {
		newPath = normalize(newPath);
		const realPath = join(this.driver.rootDirectory, newPath);
		return new Promise((resolve, reject) => {
			rename(this.realPath, realPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(this.driver.directory(newPath));
			});
		});
	}

	readdir(): Promise<(LocalFile | LocalDirectory)[]> {
		return new Promise((resolve, reject) => {
			readdir(this.realPath, (err, entries) => {
				if (err) {
					return reject(err);
				}
				const results = entries.map<Promise<LocalFile | LocalDirectory>>(entry => new Promise((resolve, reject) => {
					const path = join(this.path, entry);
					const realPath = join(this.realPath, entry);
					lstat(realPath, (err, stat) => {
						if (err) {
							return reject(err);
						}
						return resolve(
							stat.isDirectory()
								? this.driver.directory(path)
								: this.driver.file(path)
						);
					});
				}));
				Promise.all(results).then(resolve).catch(reject);
			});
		});
	}
}