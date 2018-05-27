import { FileSystemQueued, Stats, QueuedCommand } from '../FileSystem';
import Deferred from '../Deferred';
import * as FTPClient from 'ftp';
import { Duplex, Readable, Writable, Transform } from 'stream';
import { join, dirname, basename, sep } from 'path';
import { FileNotFound, OperationNotSupported, FileAlreadyExists } from '../Errors';

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

export interface FTPFileSystemOptions extends FTPClient.Options {
	debug?: (msg: string) => void
}

export class FTPFileSystem extends FileSystemQueued {

	private disposed: boolean;
	private connection?: FTPClient;
	private connectionState: FTPConnectionState;

	constructor(
		private readonly options: FTPFileSystemOptions
	) {
		super();
		this.disposed = false;
		this.connectionState = FTPConnectionState.Closed;
	}

	protected getConnection(): Promise<FTPClient> {
		return new Promise((resolve, reject) => {
			if (this.connectionState === FTPConnectionState.Disconnecting) {
				return reject(new Error(`Filesystem is currently disconnecting.`));
			}
			else if (this.connectionState === FTPConnectionState.Ready) {
				return resolve(this.connection!);
			}
			else if (this.connectionState === FTPConnectionState.Closed) {
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
			const onError = (err) => {
				this.connection!.removeListener('ready', onReady);
				reject(err);
			}

			this.connection!.once('ready', onReady);
			this.connection!.once('error', onError);
			
			if (this.connectionState !== FTPConnectionState.Connecting) {
				this.connectionState = FTPConnectionState.Connecting;
				this.connection!.connect(this.options);
			}
		});
	}

	protected async processCommand(cmd: QueuedCommand, resolve: (value?: any) => void | Promise<void>, reject: (reason?: any) => void | Promise<void>, next: () => void | Promise<void>): Promise<void> {
		
		const conn = await this.getConnection();

		switch (cmd.cmd) {
			case 'stat':
				const path = normalizePath(cmd.path);
				if (path === '/') {
					resolve(new Stats(false, true, false, 0, new Date(), new Date(), new Date()));
					return next();
				}
				cmd.path = dirname(path);
				cmd.filename = basename(path);
			case 'ls':
			case 'ls-stat':
				conn.list(normalizePath(cmd.path), (err, entries) => {
					if (err) {
						reject(err);
						return next();
					}

					entries = entries.filter(entry => entry.name !== '.' && entry.name !== '..');

					if (cmd.cmd === 'stat') {
						const entry = entries.find(entry => entry.name === cmd.filename);
						if (entry) {
							resolve(new Stats(
								entry.type === '-',
								entry.type === 'd',
								entry.type === 'l',
								parseInt(entry.size),
								entry.date,
								entry.date,
								entry.date
							));
						} else {
							reject(new FileNotFound(cmd.path));
						}
						return next();
					}

					if (cmd.cmd === 'ls') {
						resolve(entries.map(entry => entry.name));
						return next();
					}

					resolve(entries.map(entry => [
						entry.name,
						new Stats(
							entry.type === '-',
							entry.type === 'd',
							entry.type === 'l',
							parseInt(entry.size),
							entry.date,
							entry.date,
							entry.date
						)
					] as [string, Stats]));
					return next();
				});
				break;
			case 'rmfile':
				conn.delete(normalizePath(cmd.path), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			case 'rmdir':
				conn.rmdir(normalizePath(cmd.path), cmd.recursive === true, (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			case 'mkdir':
				conn.mkdir(normalizePath(cmd.path), cmd.recursive === true, (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			case 'rename':
				conn.rename(normalizePath(cmd.oldPath), normalizePath(cmd.newPath), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			// case 'copy':
			// 	reject(new OperationNotSupported(cmd.cmd));
			// 	next();
			// 	break;
			case 'get':
				conn.get(normalizePath(cmd.path), (err, stream) => {
					if (err) {
						reject(err);
						return next();
					}
					stream.on('finish', next);
					stream.on('error', next);
					resolve(stream);
				});
				break;
			case 'put':
				conn.put(cmd.stream, normalizePath(cmd.path), next);
				resolve(cmd.stream);
				break;
			default:
				reject(new OperationNotSupported(cmd.cmd));
				next();
				break;
		}
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	async disposeAsync(): Promise<void> {
		if (this.disposed === false) {
			this.disposed = true;
			this.connectionState = FTPConnectionState.Disconnecting;
			if (this.connection) {
				this.connection.destroy();
				(this as any).connection = undefined;
			}
			(this as any).queue = undefined;
			(this as any).queueMap = undefined;
		}
	}

}