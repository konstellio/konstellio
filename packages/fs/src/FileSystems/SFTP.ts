import { FileSystem, Stats, FileSystemQueued, QueuedCommand } from '../FileSystem';
import Deferred from '../Deferred';
import { Client, SFTPWrapper, ConnectConfig } from 'ssh2';
import { Duplex, Readable, Writable, Transform } from 'stream';
import { join, dirname, basename, sep } from 'path';
import { FileNotFound, OperationNotSupported, FileAlreadyExists } from '../Errors';
import { constants } from 'fs';

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

export enum SFTPConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready
}

export interface SFTPFileSystemOptions extends ConnectConfig {
}

export class SFTPFileSystem extends FileSystemQueued {

	private disposed: boolean;
	protected connection?: Client;
	protected connectionState: SFTPConnectionState;
	protected sftp?: SFTPWrapper;

	constructor(
		protected readonly options: SFTPFileSystemOptions
	) {
		super();
		this.disposed = false;
		this.connectionState = SFTPConnectionState.Closed;
	}

	clone() {
		return new SFTPFileSystem(this.options);
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
			const onError = (err) => {
				this.connection!.removeListener('sftpready', onReady);
				reject(err);
			}

			this.connection!.once('sftpready', onReady);
			this.connection!.once('error', onError);

			if (this.connectionState !== SFTPConnectionState.Connecting) {
				this.connectionState = SFTPConnectionState.Connecting;
				this.connection!.connect(this.options);
			}
		});
	}

	protected async processCommand(cmd: QueuedCommand, resolve: (value?: any) => void | Promise<void>, reject: (reason?: any) => void | Promise<void>, next: () => void | Promise<void>): Promise<void> {

		const [, sftp] = await this.getConnection();

		switch (cmd.cmd) {
			case 'stat':
				sftp.stat(normalizePath(cmd.path), (err, stat) => {
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
					return next();
				});
				break;
			case 'ls':
			case 'ls-stat':
				sftp.readdir(normalizePath(cmd.path), (err, entries) => {
					if (err) {
						reject(err);
						return next();
					}

					entries = entries.filter(entry => entry.filename !== '.' && entry.filename !== '..');

					if (cmd.cmd === 'ls') {
						resolve(entries.map(entry => entry.filename));
						return next();
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
					return next();
				});
				break;
			case 'rmfile':
				sftp.unlink(normalizePath(cmd.path), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			case 'rmdir':
				// TODO: recursive ?
				sftp.rmdir(normalizePath(cmd.path), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			case 'mkdir':
				// TODO: recursive ?
				sftp.mkdir(normalizePath(cmd.path), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
					return next();
				});
				break;
			case 'rename':
				sftp.rename(normalizePath(cmd.oldPath), normalizePath(cmd.newPath), (err) => {
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
				const readStream = sftp.createReadStream(normalizePath(cmd.path));
				readStream.on('end', next);
				readStream.on('error', next);
				resolve(readStream);
				break;
			case 'put':
				const writeStream = cmd.stream.pipe(sftp.createWriteStream(normalizePath(cmd.path)));
				writeStream.on('finish', next);
				writeStream.on('error', next);
				resolve(writeStream);
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
			this.connectionState = SFTPConnectionState.Disconnecting;
			if (this.connection) {
				this.connection!.destroy();
				(this as any).connection = undefined;
			}
			(this as any).queue = undefined;
			(this as any).queueMap = undefined;
		}
	}

}