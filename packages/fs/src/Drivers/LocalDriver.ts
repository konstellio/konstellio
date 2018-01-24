import { exists, unlink, stat, mkdir, rename, copyFile, createReadStream, createWriteStream, ReadStream, WriteStream, readdir } from 'fs';
import { join, normalize, basename, dirname } from 'path';
import { Driver, File, Directory, Stats, Node } from '../Driver';

export class LocalDriver extends Driver<LocalFile, LocalDirectory> {

	public constructor(
		public readonly rootDirectory: string,
		public readonly directoryMode = 0o777,
		public readonly fileMode = 0o644,
		public readonly encoding = 'utf8'
	) {
		super();
		this.fileConstructor = LocalFile;
		this.directoryConstructor = LocalDirectory;
		this.rootDirectory = normalize(this.rootDirectory);
	}

}

export class LocalFile extends File<LocalFile, LocalDirectory> {
	protected readonly driver: LocalDriver;
	public readonly parent: LocalDirectory;

	get realPath(): string {
		return this.parent
			? join(this.parent.realPath, this.name)
			: join(this.driver.rootDirectory, this.name);
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
		destPath = join(this.driver.rootDirectory, normalize(destPath));
		return new Promise((resolve, reject) => {
			copyFile(this.realPath, destPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(this.driver.getFile(destPath));
			});
		});
	}

	rename(newPath: string): Promise<LocalFile> {
		newPath = join(this.driver.rootDirectory, normalize(newPath));
		return new Promise((resolve, reject) => {
			rename(this.realPath, newPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(this.driver.getFile(newPath));
			});
		});
	}

	stat(): Promise<Stats> {
		return new Promise((resolve, reject) => {
			stat(this.realPath, (err, stats) => {
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
	public readonly driver: LocalDriver;
	public readonly parent: LocalDirectory;

	get realPath(): string {
		return this.parent
			? join(this.parent.realPath, this.name)
			: join(this.driver.rootDirectory, this.name);
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
		newPath = join(this.driver.rootDirectory, normalize(newPath));
		return new Promise((resolve, reject) => {
			rename(this.realPath, newPath, err => {
				if (err) {
					return reject(err);
				}
				resolve(new LocalDirectory(this.driver, basename(newPath), this.parent));
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
					const path = join(this.fullPath, entry);
					const realPath = join(this.realPath, entry);
					stat(realPath, (err, stat) => {
						if (err) {
							return reject(err);
						}
						return resolve(
							stat.isDirectory()
								? this.driver.getDirectory(path)
								: this.driver.getFile(path)
						);
					});
				}));
				Promise.all(results).then(resolve).catch(reject);
			});
		});
	}
}