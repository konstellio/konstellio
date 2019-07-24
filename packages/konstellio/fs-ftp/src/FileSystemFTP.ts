import {
	FileSystem,
	Stats,
	FileSystemCacheable,
	FileNotFound,
	OperationNotSupported,
	FileAlreadyExists,
	CouldNotConnect,
} from '@konstellio/fs';
import { Pool, Deferred } from '@konstellio/promised';
import * as FTPClient from 'ftp';
import { Readable, Writable, Transform } from 'stream';
import { dirname, basename, sep } from 'path';
import { ConnectionOptions } from 'tls';

function normalizePath(path: string) {
	path = path
		.split(sep)
		.join('/')
		.trim();
	while (path.startsWith('/')) {
		path = path.substr(1);
	}
	while (path.endsWith('/')) {
		path = path.substr(0, path.length - 1);
	}
	if (!path.startsWith('/')) {
		path = `/${path}`;
	}
	return path;
}

export enum FTPConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready,
}

export interface FileSystemFTPOptions {
	host?: string;
	port?: number;
	secure?: string | boolean;
	secureOptions?: ConnectionOptions;
	user?: string;
	password?: string;
	connTimeout?: number;
	pasvTimeout?: number;
	keepalive?: number;
	debug?: (msg: string) => void;
}

export class FileSystemFTP extends FileSystem implements FileSystemCacheable {
	private disposed: boolean;
	private connection?: FTPClient;
	private connectionState: FTPConnectionState;
	private pool: Pool;
	private cache: Map<string, [number, Deferred<any>]>;

	constructor(private readonly options: FileSystemFTPOptions, protected ttl: number = 60000) {
		super();
		this.disposed = false;
		this.connectionState = FTPConnectionState.Closed;
		this.pool = new Pool([{}]);
		this.cache = new Map();
	}

	clone() {
		return new FileSystemFTP(this.options);
	}

	protected getConnection(): Promise<FTPClient> {
		return new Promise((resolve, reject) => {
			if (this.connectionState === FTPConnectionState.Disconnecting) {
				return reject(new Error(`Filesystem is currently disconnecting.`));
			} else if (this.connectionState === FTPConnectionState.Ready) {
				return resolve(this.connection!);
			} else if (this.connectionState === FTPConnectionState.Closed) {
				this.connection = new FTPClient();
				this.connection.on('end', () => {
					this.connectionState = FTPConnectionState.Closed;
				});
				this.connection.on('ready', () => {
					this.connectionState = FTPConnectionState.Ready;
				});
			}

			const onReady = () => {
				this.connection!.removeListener('error', onError);
				resolve(this.connection!);
			};
			const onError = (err: Error) => {
				this.connection!.removeListener('ready', onReady);
				reject(new CouldNotConnect(err));
			};

			this.connection!.once('ready', onReady);
			this.connection!.once('error', onError);

			if (this.connectionState !== FTPConnectionState.Connecting) {
				this.connectionState = FTPConnectionState.Connecting;
				this.connection!.connect(this.options);
			}
		});
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async dispose(): Promise<void> {
		if (!this.disposed) {
			this.disposed = true;
			this.connectionState = FTPConnectionState.Disconnecting;
			if (this.connection) {
				this.connection.destroy();
				(this as any).connection = undefined;
			}
			this.pool.dispose();
			(this as any).queue = undefined;
			(this as any).queueMap = undefined;
			(this as any).pool = undefined;
		}
	}

	async flushCache(): Promise<void> {
		this.cache = new Map();
	}

	setTTL(ttl: number): void {
		this.ttl = ttl;
	}

	protected cacheOrCompute<T = any>(hash: string, compute: () => Promise<T>): Promise<T> {
		const now = Date.now();
		if (this.cache.has(hash)) {
			const [expired, defer] = this.cache.get(hash)!;
			if (expired >= now) {
				return defer.promise as Promise<T>;
			}
		}
		const defer = new Deferred<T>();
		this.cache.set(hash, [now + this.ttl, defer]);

		compute()
			.then(res => defer.resolve(res))
			.catch(err => defer.reject(err));

		return defer.promise;
	}

	async stat(path: string): Promise<Stats> {
		const normalized = normalizePath(path);
		if (normalized === '/') {
			return new Stats(false, true, false, 0, new Date(), new Date(), new Date());
		}
		const filename = basename(normalized);
		const entries = await this.readDirectory(dirname(normalized), true);
		const entry = entries.find(([name]) => name === filename);
		if (entry) {
			return entry[1];
		}
		throw new FileNotFound(path);
	}

	exists(path: string): Promise<boolean> {
		return this.stat(path).then(() => true, () => false);
	}

	async unlink(path: string, recursive = false): Promise<void> {
		const stats = await this.stat(path);
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		if (stats.isFile) {
			return new Promise<void>((resolve, reject) => {
				conn.delete(normalizePath(path), err => {
					if (err) {
						reject(err);
					} else {
						this.cache.delete(`readdir:${normalizePath(dirname(path))}`);
						this.cache.delete(`readdirstat:${normalizePath(dirname(path))}`);
						resolve();
					}
					this.pool.release(token);
				});
			});
		} else if (stats.isDirectory) {
			return new Promise<void>((resolve, reject) => {
				conn.rmdir(normalizePath(path), recursive, err => {
					if (err) {
						reject(err);
					} else {
						this.cache.delete(`readdir:${normalizePath(dirname(path))}`);
						this.cache.delete(`readdirstat:${normalizePath(dirname(path))}`);
						resolve();
					}
					this.pool.release(token);
				});
			});
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		throw new OperationNotSupported('copy');
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		return new Promise<void>((resolve, reject) => {
			conn.rename(normalizePath(oldPath), normalizePath(newPath), err => {
				if (err) {
					reject(err);
				} else {
					this.cache.delete(`readdir:${normalizePath(dirname(oldPath))}`);
					this.cache.delete(`readdirstat:${normalizePath(dirname(oldPath))}`);
					this.cache.delete(`readdir:${normalizePath(dirname(newPath))}`);
					this.cache.delete(`readdirstat:${normalizePath(dirname(newPath))}`);
					resolve();
				}
				this.pool.release(token);
			});
		});
	}

	async createReadStream(path: string): Promise<Readable> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		return new Promise<Readable>((resolve, reject) => {
			conn.get(normalizePath(path), (err, stream) => {
				if (err) {
					reject(err);
					this.pool.release(token);
					return;
				}
				const transfer = new Transform({
					transform(chunk, encode, done) {
						done(undefined, chunk);
					},
				});
				transfer.on('end', () => this.pool.release(token));
				transfer.on('error', () => this.pool.release(token));
				resolve(stream.pipe(transfer));
			});
		});
	}

	async createWriteStream(path: string, overwrite?: boolean): Promise<Writable> {
		if (overwrite !== true) {
			const exists = await this.exists(path);
			if (exists) {
				throw new FileAlreadyExists();
			}
		}

		const token = await this.pool.acquires();
		const conn = await this.getConnection();

		const stream = new Transform({
			transform(chunk, _, done) {
				this.push(chunk);
				done();
			},
		});

		return new Promise<Writable>(resolve => {
			conn.put(stream, normalizePath(path), err => {
				this.cache.delete(`readdir:${normalizePath(dirname(path))}`);
				this.cache.delete(`readdirstat:${normalizePath(dirname(path))}`);
				this.pool.release(token);
			});
			resolve(stream);
		});
	}

	async createDirectory(path: string, recursive?: boolean): Promise<void> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		return new Promise<void>((resolve, reject) => {
			conn.mkdir(normalizePath(path), recursive === true, err => {
				if (err) {
					reject(err);
				} else {
					this.cache.delete(`readdir:${normalizePath(dirname(path))}`);
					this.cache.delete(`readdirstat:${normalizePath(dirname(path))}`);
					resolve();
				}
				this.pool.release(token);
			});
		});
	}

	async readDirectory(path: string): Promise<string[]>;
	async readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
	async readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		return this.cacheOrCompute(`readdir${stat && 'stat'}:${normalizePath(path)}`, () =>
			this.readDirectoryImpl(path, stat!)
		);
	}

	protected async readDirectoryImpl(path: string): Promise<string[]>;
	protected async readDirectoryImpl(path: string, stat: boolean): Promise<[string, Stats][]>;
	protected async readDirectoryImpl(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		return new Promise<(string | [string, Stats])[]>((resolve, reject) => {
			conn.list(normalizePath(path), (err, entries) => {
				if (err) {
					reject(err);
					this.pool.release(token);
					return;
				}

				entries = entries.filter(entry => entry.name !== '.' && entry.name !== '..');

				if (stat !== true) {
					resolve(entries.map(entry => entry.name));
					this.pool.release(token);
					return;
				}

				resolve(
					entries.map(
						entry =>
							[
								entry.name,
								new Stats(
									entry.type === '-',
									entry.type === 'd',
									entry.type === 'l',
									parseInt(entry.size, 10),
									entry.date,
									entry.date,
									entry.date
								),
							] as [string, Stats]
					)
				);
				this.pool.release(token);
			});
		});
	}
}

export default FileSystemFTP;
