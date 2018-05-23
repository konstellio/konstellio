import { exists, unlink, lstat, rename, copyFile, createReadStream, createWriteStream, readdir, writeFile } from 'fs';
import { Readable, Writable } from 'stream';
import * as mkdirp from 'mkdirp';
import { join, normalize, basename, dirname, sep, relative } from 'path';
import { FileSystem, Stats } from '../FileSystem';

const ZeroBuffer = new Buffer(0);

export class LocalFileSystem extends FileSystem {

	private disposed: boolean;

	constructor(
		public readonly rootDirectory: string,
		public readonly directoryMode = 0o777,
		public readonly fileMode = 0o644
	) {
		super();
		this.disposed = false;
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		if (this.disposed === false) {
			this.disposed = true;
		}
	}

	stat(path: string): Promise<Stats> {
		return new Promise((resolve, reject) => {
			lstat(join(this.rootDirectory, path), (err, stats) => {
				if (err) {
					return reject(err);
				}
				resolve(new Stats(
					stats.isFile(),
					stats.isDirectory(),
					stats.isSymbolicLink(),
					stats.size,
					stats.atime,
					stats.mtime,
					stats.ctime
				));
			});
		});
	}

	exists(path: string): Promise<boolean> {
		return this.stat(path).then(() => true, () => false);
	}

	async unlink(path: string, recursive = false): Promise<void> {
		const stats = await this.stat(path);
		if (stats.isFile) {
			return await new Promise<void>((resolve, reject) => {
				unlink(join(this.rootDirectory, path), (err) => {
					if (err) {
						return reject(err);
					}
					return resolve();
				})
			})
		}
		else if (stats.isDirectory) {
			const children = await this.readDirectory(path, true);
			for (const [child, stats] of children) {
				await this.unlink(join(path, child), true);
				await new Promise<void>((resolve, reject) => {
					unlink(join(path, child), (err) => {
						if (err) {
							return reject(err);
						}
						return resolve();
					});
				});
			}
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		const stats = await this.stat(source);
		if (stats.isFile) {
			return await new Promise<void>((resolve, reject) => {
				copyFile(
					join(this.rootDirectory, source),
					join(this.rootDirectory, destination),
					(err) => {
						if (err) {
							return reject(err);
						}
						return resolve();
					}
				);
			});
		}
		else if (stats.isDirectory) {
			debugger;
		}
	}

	rename(oldPath: string, newPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			rename(
				join(this.rootDirectory, oldPath),
				join(this.rootDirectory, newPath),
				(err) => {
					if (err) {
						return reject(err);
					}
					return resolve()
				}
			);
		});
	}

	async createReadStream(path: string): Promise<Readable> {
		return createReadStream(
			join(this.rootDirectory, path)
		);
	}

	async createWriteStream(path: string, overwrite?: boolean, encoding?: string): Promise<Writable> {
		return createWriteStream(
			join(this.rootDirectory, path),
			{
				mode: this.fileMode,
				encoding: encoding,
				autoClose: true
			}
		);
	}
	
	createFile(path: string, recursive?: boolean): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const dirPath = dirname(path);
			await this.createDirectory(dirPath, recursive);

			writeFile(join(this.rootDirectory, path), ZeroBuffer, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});

	}

	createDirectory(path: string, recursive?: boolean): Promise<void> {
		return new Promise((resolve, reject) => {
			mkdirp(join(this.rootDirectory, path), this.directoryMode, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	readDirectory(path: string): Promise<string[]>
	readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>
	readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		return new Promise((resolve, reject) => {
			readdir(join(this.rootDirectory, path), (err, entries) => {
				if (err) {
					return reject(err)
				}
				if (stat !== true) {
					return resolve(entries);
				}

				Promise.all(entries.map<Promise<Stats>>(entry => {
					const entryPath = join(path, entry);
					return this.stat(entryPath);
				}))
				.then(
					(stats) => resolve(entries.map((entry, idx) => [entry, stats[idx]] as [string, Stats])),
					(err) => reject(err)
				)
			});
		});
	}

}