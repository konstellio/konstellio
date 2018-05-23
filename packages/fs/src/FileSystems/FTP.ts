import { FileSystem, Stats } from '../FileSystem';
import * as FTPClient from 'jsftp';
import { Duplex, Readable, Writable, Transform } from 'stream';
import { join, dirname, basename, sep } from 'path';
import { parseEntries } from 'parse-listing';

const ZeroBuffer = new Buffer(0);

function normalizePath(path: string) {
	path = path.split(sep).join('/').trim();
	while (path.startsWith('/')) {
		path = path.substr(1);
	}
	while (path.endsWith('/')) {
		path = path.substr(0, path.length - 1);
	}
	if (path.startsWith('/') === false) {
		path = '/' + path;
	}
	return path;
}

export enum FTPConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready
}

export class FTPFileSystem extends FileSystem {

	private disposed: boolean;
	private connection: FTPClient;

	constructor(
		options: any
	) {
		super();
		this.disposed = false;
		this.connection = new FTPClient(options);
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		if (this.disposed === false) {
			this.disposed = true;
			if (this.connection) {
				this.connection.destroy();
				(this as any).connection = undefined;
			}
		}
	}

	async stat(path: string): Promise<Stats> {
		path = normalizePath(path);
		if (path === '' || path === '/') {
			return new Stats(false, true, false, 0, new Date(), new Date(), new Date());
		}
		const pathDir = dirname(path);
		const pathBase = basename(path);
		const entries = await this.readDirectory(pathDir, true);
		const entry = entries.find(([name]) => name === pathBase);
		if (!entry) {
			throw new Error(`File ${path} not found.`);
		}
		return entry[1];
	}

	exists(path: string): Promise<boolean> {
		return this.stat(path).then(() => true, () => false);
	}

	async unlink(path: string, recursive = false): Promise<void> {
		path = normalizePath(path);
		const stats = await this.stat(path);
		if (stats.isFile) {
			return await new Promise<void>((resolve, reject) => {
				this.connection.raw('dele', path, (err: Error, resp) => {
					if (err) {
						return reject(err);
					}
					
					if (resp.code !== 250) {
						return reject(new Error(resp.text));
					}
					
					return resolve();
				});
			});
		}
		else if (stats.isDirectory) {
			const children = await this.readDirectory(path, true);
			for (const [child, stats] of children) {
				await this.unlink(join(path, child), true);
			}
			await new Promise<void>((resolve, reject) => {
				this.connection.raw('rmd', path, (err: Error, resp) => {
					if (err) {
						return reject(err);
					}

					if (resp.code !== 250) {
						return reject(new Error(resp.text));
					}
					
					return resolve();
				});
			});
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		throw new Error(`Not implemented.`);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.connection.rename(normalizePath(oldPath), normalizePath(newPath), (err: Error, res) => {
				if (err) {
					return reject(err);
				}

				return resolve();
			});
		});
	}

	createReadStream(path: string): Promise<Readable> {
		return new Promise((resolve, reject) => {
			this.connection.get(normalizePath(path), (err: Error, stream: Readable) => {
				if (err) {
					return reject(err);
				}

				return resolve(stream);
			});
		});
	}

	async createWriteStream(path: string, overwrite?: boolean, encoding?: string): Promise<Writable> {
		const stream = new Transform({
			transform(chunk, encoding, done) {
				this.push(chunk);
				done();
			}
		});

		this.connection.put(stream, normalizePath(path));

		return stream;
	}

	createDirectory(path: string, recursive?: boolean): Promise<void> {
		// TODO recursive
		return new Promise((resolve, reject) => {
			this.connection.raw('mkd', normalizePath(path), (err: Error, resp) => {
				if (err) {
					return reject(err);
				}

				if (resp.code !== 257) {
					return reject(new Error(resp.text));
				}

				return resolve();
			})
		});
	}

	readDirectory(path: string): Promise<string[]>
	readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>
	readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		return new Promise((resolve, reject) => {
			this.connection.list(normalizePath(path), (err: Error, listing) => {
				if (err) {
					return reject(err);
				}

				parseEntries(listing, (err: Error, entries) => {
					if (err) {
						return reject(err);
					}

					if (stat !== true) {
						return resolve(entries.map(entry => entry.name));
					}
	
					return resolve(entries.map(entry => [
						entry.name,
						new Stats(
							entry.type === 0,
							entry.type === 1,
							entry.type === 2,
							parseInt(entry.size),
							new Date(entry.time),
							new Date(entry.time),
							new Date(entry.time)
						)
					] as [string, Stats]));
				});
			});
		});
	}

}