import { FileSystem, Stats, OperationNotSupported, FileAlreadyExists, CouldNotConnect } from '@konstellio/fs';
import { Pool } from '@konstellio/promised';
import { Client, SFTPWrapper } from 'ssh2';
import { Readable, Writable, Transform } from 'stream';
import { sep } from 'path';
import { constants } from 'fs';

function normalizePath(path: string) {
	path = path.split(sep).join('/').trim();
	while (path.startsWith('/')) {
		path = path.substr(1);
	}
	while (path.endsWith('/')) {
		path = path.substr(0, path.length - 1);
	}
	if (!path.startsWith('/')) {
		path = '/' + path;
	}
	return path;
}

export enum SFTPConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready
}

export interface FileSystemSFTPAlgorithms {
	kex?: string[];
	cipher?: string[];
	serverHostKey?: string[];
	hmac?: string[];
	compress?: string[];
}

export interface FileSystemSFTPOptions {
	host?: string;
	port?: number;
	forceIPv4?: boolean;
	forceIPv6?: boolean;
	hostHash?: "md5" | "sha1";
	hostVerifier?: (keyHash: string) => boolean;
	username?: string;
	password?: string;
	agent?: string;
	privateKey?: Buffer | string;
	passphrase?: string;
	localHostname?: string;
	localUsername?: string;
	tryKeyboard?: boolean;
	keepaliveInterval?: number;
	keepaliveCountMax?: number;
	readyTimeout?: number;
	strictVendor?: boolean;
	sock?: NodeJS.ReadableStream;
	agentForward?: boolean;
	algorithms?: FileSystemSFTPAlgorithms;
	debug?: (information: string) => any;
}

export class FileSystemSFTP extends FileSystem {

	private disposed: boolean;
	protected connection?: Client;
	protected connectionState: SFTPConnectionState;
	protected sftp?: SFTPWrapper;
	private pool: Pool;

	constructor(
		protected readonly options: FileSystemSFTPOptions
	) {
		super();
		this.disposed = false;
		this.connectionState = SFTPConnectionState.Closed;
		this.pool = new Pool([{}]);
	}

	clone() {
		return new FileSystemSFTP(this.options);
	}

	protected getConnection(): Promise<[Client, SFTPWrapper]> {
		return new Promise((resolve, reject) => {
			if (this.connectionState === SFTPConnectionState.Disconnecting) {
				return reject(new Error(`Filesystem is currently disconnecting.`));
			}
			else if (this.connectionState === SFTPConnectionState.Ready) {
				return resolve([this.connection!, this.sftp!]);
			}
			else if (this.connectionState === SFTPConnectionState.Closed) {
				this.connection = new Client();
				this.connection.on('end', () => {
					this.connectionState = SFTPConnectionState.Closed;
				});
				this.connection.on('ready', () => {
					this.connection!.sftp((err, sftp) => {
						if (err) {
							// return this.connection!.destroy();
							return;
						}

						this.connectionState = SFTPConnectionState.Ready;
						this.sftp = sftp;

						this.connection!.emit('sftpready');
					});
				});
			}

			const onReady = () => {
				this.connection!.removeListener('error', onError);
				resolve([this.connection!, this.sftp!]);
			};
			const onError = (err: Error) => {
				this.connection!.removeListener('sftpready', onReady);
				reject(new CouldNotConnect(err));
			};

			this.connection!.once('sftpready', onReady);
			this.connection!.once('error', onError);

			if (this.connectionState !== SFTPConnectionState.Connecting) {
				this.connectionState = SFTPConnectionState.Connecting;
				this.connection!.connect(this.options);
			}
		});
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		if (!this.disposed) {
			this.disposed = true;
			this.connectionState = SFTPConnectionState.Disconnecting;
			if (this.connection) {
				this.connection!.destroy();
				(this as any).connection = undefined;
			}
			this.pool.dispose();
			(this as any).queue = undefined;
			(this as any).queueMap = undefined;
			(this as any).pool = undefined;
		}
	}

	async stat(path: string): Promise<Stats> {
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();

		return new Promise<Stats>((resolve, reject) => {
			sftp.stat(normalizePath(path), (err, stat) => {
				if (err) {
					reject(err);
				} else {
					resolve(new Stats(
						stat.isFile(),
						stat.isDirectory(),
						stat.isSymbolicLink(),
						stat.size,
						new Date(stat.atime),
						new Date(stat.mtime),
						new Date(stat.mtime)
					));
				}
				this.pool.release(token);
			});
		});
	}

	exists(path: string): Promise<boolean> {
		return this.stat(path).then(() => true, () => false);
	}

	async unlink(path: string): Promise<void> {
		const stats = await this.stat(path);
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();
		if (stats.isFile) {
			return new Promise<void>((resolve, reject) => {
				sftp.unlink(normalizePath(path), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					this.pool.release(token);
				});
			});
		}
		else if (stats.isDirectory) {
			return new Promise<void>((resolve, reject) => {
				// if (recursive === true) {
				// 	return new Promise<[number | null, string | undefined, Buffer]>((resolve, reject) => {
				// 		conn.exec(`rm -fr "${normalizePath(path)}"`, (err, stream) => {
				// 			if (err) {
				// 				return reject(err);
				// 			}
			
				// 			const chunks: Buffer[] = [];
			
				// 			stream.on('exit', (code, signal) => {
				// 				resolve([code, signal, Buffer.concat(chunks)]);
				// 			});
			
				// 			stream.on('data', chunk => {
				// 				chunks.push(chunk);
				// 			});
				// 		});
				// 	}).then(([code, signal, out]) => {
				// 		// TODO: check error ?
				// 		this.pool.release(token);
				// 	});
				// } else {
					sftp.rmdir(normalizePath(path), (err) => {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
						this.pool.release(token);
					});
				// }
			});
		}
	}

	async copy(): Promise<void> {
		throw new OperationNotSupported('copy');
		// const token = await this.pool.acquires();
		// const [conn] = await this.getConnection();
		// return new Promise<[number | null, string | undefined, Buffer]>((resolve, reject) => {
		// 	conn.exec(`cp -r "${normalizePath(source)}" "${normalizePath(destination)}"`, (err, stream) => {
		// 		if (err) {
		// 			return reject(err);
		// 		}

		// 		const chunks: Buffer[] = [];

		// 		stream.on('exit', (code, signal) => {
		// 			resolve([code, signal, Buffer.concat(chunks)]);
		// 		});

		// 		stream.on('data', chunk => {
		// 			chunks.push(chunk);
		// 		});
		// 	});
		// }).then(([code, signal, out]) => {
		// 	// TODO: check error ?
		// 	this.pool.release(token);
		// });
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();
		return new Promise<void>((resolve, reject) => {
			sftp.rename(normalizePath(oldPath), normalizePath(newPath), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
				this.pool.release(token);
			});
		});
	}

	async createReadStream(path: string): Promise<Readable> {
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();
		return new Promise<Readable>((resolve) => {
			const readStream = sftp.createReadStream(normalizePath(path));
			readStream.on('end', () => this.pool.release(token));
			readStream.on('error', () => this.pool.release(token));
			resolve(readStream);
		});
	}

	async createWriteStream(path: string, overwrite?: boolean): Promise<Writable> {
		const exists = await this.exists(path);
		if (exists) {
			if (overwrite !== true) {
				throw new FileAlreadyExists();
			}
		}
		
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();
		const stream = new Transform({
			transform(chunk, _, done) {
				this.push(chunk);
				done();
			}
		});

		return new Promise<Writable>((resolve) => {
			const writeStream = stream.pipe(sftp.createWriteStream(normalizePath(path)));
			writeStream.on('finish', () => this.pool.release(token));
			writeStream.on('error', () => this.pool.release(token));
			resolve(writeStream);
		});
	}

	async createDirectory(path: string): Promise<void> {
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();
		return new Promise<void>((resolve, reject) => {
			sftp.mkdir(normalizePath(path), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
				this.pool.release(token);
			});
		});
	}

	async readDirectory(path: string): Promise<string[]>;
	async readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
	async readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		const token = await this.pool.acquires();
		const [, sftp] = await this.getConnection();
		return new Promise<(string | [string, Stats])[]>((resolve, reject) => {
			sftp.readdir(normalizePath(path), (err, entries) => {
				if (err) {
					reject(err);
					this.pool.release(token);
					return;
				}

				entries = entries.filter(entry => entry.filename !== '.' && entry.filename !== '..');

				if (stat !== true) {
					resolve(entries.map(entry => entry.filename));
					this.pool.release(token);
					return;
				}

				resolve(entries.map(entry => [
					entry.filename,
					new Stats(
						(entry.attrs.mode & constants.S_IFREG) > 0,
						(entry.attrs.mode & constants.S_IFDIR) > 0,
						(entry.attrs.mode & constants.S_IFLNK) > 0,
						entry.attrs.size,
						new Date(entry.attrs.atime),
						new Date(entry.attrs.mtime),
						new Date(entry.attrs.mtime)
					)
				] as [string, Stats]));
				this.pool.release(token);
			});
		});
	}

}