import { FileSystem, Stats } from '../FileSystem';
import Deferred from '../Deferred';
import * as FTPClient from 'ftp';
import { Duplex, Readable, Writable, Transform } from 'stream';
import { join, dirname, basename, sep } from 'path';
import { FileNotFound, OperationNotSupported, FileAlreadyExists } from '../Errors';

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

interface CommandPromise {
	cmd: Command
	deferred: Deferred<any>
}

type Command = CommandStat | CommandList | CommandListStat | CommandCreateFile | CommandCreateDirectory | CommandRemoveFile | CommandRemoveDirectory | CommandCopy | CommandRename | CommandDownload | CommandUpload;

interface CommandStat { cmd: 'stat', path: string, filename?: string }
interface CommandList { cmd: 'ls', path: string }
interface CommandListStat { cmd: 'ls-stat', path: string }
interface CommandCreateFile { cmd: 'mkfile', path: string }
interface CommandCreateDirectory { cmd: 'mkdir', path: string, recursive?: boolean }
interface CommandRemoveFile { cmd: 'rmfile', path: string }
interface CommandRemoveDirectory { cmd: 'rmdir', path: string, recursive?: boolean }
interface CommandCopy { cmd: 'copy', source: string, destination: string }
interface CommandRename { cmd: 'rename', oldPath: string, newPath: string }
interface CommandDownload { cmd: 'get', path: string }
interface CommandUpload { cmd: 'put', path: string, stream: Readable }

export class FTPFileSystem extends FileSystem {

	private disposed: boolean;
	private connection?: FTPClient;
	private connectionState: FTPConnectionState;
	private queue: CommandPromise[];
	private queueMap: Map<string, CommandPromise>;
	private holdQueue: boolean;

	constructor(
		private readonly options: FTPClient.Options
	) {
		super();
		this.disposed = false;
		this.connectionState = FTPConnectionState.Closed;
		this.holdQueue = false;
		this.queue = [];
		this.queueMap = new Map();
	}

	private getConnection(): Promise<FTPClient> {
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
				(this.options as any).debug = (...args) => {
					console.log(...args);
				}
				this.connection!.connect(this.options);
			}
		});
	}

	private async enqueue(cmd: CommandStat): Promise<Stats>
	private async enqueue(cmd: CommandList): Promise<string[]>
	private async enqueue(cmd: CommandListStat): Promise<[string, Stats][]>
	private async enqueue(cmd: CommandCreateFile): Promise<void>
	private async enqueue(cmd: CommandCreateDirectory): Promise<void>
	private async enqueue(cmd: CommandRemoveFile): Promise<void>
	private async enqueue(cmd: CommandRemoveDirectory): Promise<void>
	private async enqueue(cmd: CommandCopy): Promise<void>
	private async enqueue(cmd: CommandRename): Promise<void>
	private async enqueue(cmd: CommandDownload): Promise<Readable>
	private async enqueue(cmd: CommandUpload): Promise<Writable>
	private async enqueue(cmd: Command): Promise<any> {
		const hash = JSON.stringify(cmd);
		if (this.queueMap.has(hash)) {
			return this.queueMap.get(hash)!.deferred;
		}
		const cmdDeferred: CommandPromise = {
			cmd,
			deferred: new Deferred<any>()
		};

		cmdDeferred.deferred.then(() => this.queueMap.delete(hash), () => this.queueMap.delete(hash));

		this.queue.push(cmdDeferred);
		this.queueMap.set(hash, cmdDeferred);

		this.nextCommand();

		return cmdDeferred.deferred;
	}

	private async nextCommand(): Promise<void> {
		if (this.holdQueue === true) {
			return;
		}

		const conn = await this.getConnection();
		const item = this.queue.shift();
		if (item) {
			this.holdQueue = true;
			const { cmd, deferred } = item;
			const resolveAndNext = (value?: any) => {
				this.holdQueue = false;
				this.nextCommand();
				return deferred.resolve(value);
			};
			const rejectAndNext = (reason?: any) => {
				this.holdQueue = false;
				this.nextCommand();
				return deferred.reject(reason);
			};
			switch (cmd.cmd) {
				case 'stat':
					const path = normalizePath(cmd.path);
					if (path === '/') {
						resolveAndNext(new Stats(false, true, false, 0, new Date(), new Date(), new Date()));
						break;
					}
					cmd.path = dirname(path);
					cmd.filename = basename(path);
				case 'ls':
				case 'ls-stat':
					conn.list(normalizePath(cmd.path), (err, entries) => {
						if (err) {
							return rejectAndNext(err);
						}

						entries = entries.filter(entry => entry.name !== '.' && entry.name !== '..');

						if (cmd.cmd === 'stat') {
							const entry = entries.find(entry => entry.name === cmd.filename);
							if (entry) {
								return resolveAndNext(new Stats(
									entry.type === '-',
									entry.type === 'd',
									entry.type === 'l',
									parseInt(entry.size),
									entry.date,
									entry.date,
									entry.date
								));
							} else {
								return rejectAndNext(new FileNotFound());
							}
						}

						if (cmd.cmd === 'ls') {
							return resolveAndNext(entries.map(entry => entry.name));
						}

						return resolveAndNext(entries.map(entry => [
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
					});
					break;
				case 'rmfile':
					conn.delete(normalizePath(cmd.path), (err) => {
						if (err) {
							return rejectAndNext(err);
						}
						return resolveAndNext();
					});
					break;
				case 'rmdir':
					conn.rmdir(normalizePath(cmd.path), cmd.recursive === true, (err) => {
						if (err) {
							return rejectAndNext(err);
						}
						return resolveAndNext();
					});
					break;
				case 'mkdir':
					conn.mkdir(normalizePath(cmd.path), cmd.recursive === true, (err) => {
						if (err) {
							return rejectAndNext(err);
						}
						return resolveAndNext();
					});
					break;
				case 'rename':
					conn.rename(normalizePath(cmd.oldPath), normalizePath(cmd.newPath), (err) => {
						if (err) {
							return rejectAndNext(err);
						}
						return resolveAndNext();
					});
					break;
				case 'copy':
					rejectAndNext(new OperationNotSupported());
					break;
				case 'get':
					conn.get(normalizePath(cmd.path), (err, stream) => {
						if (err) {
							return rejectAndNext(err);
						}

						stream.on('end', () => {
							this.holdQueue = false;
							this.nextCommand();
						});
						stream.on('error', (err) => {
							this.holdQueue = false;
							this.nextCommand();
						});

						deferred.resolve(stream);
					});
					break;
				case 'put':
					conn.put(cmd.stream, normalizePath(cmd.path), (err) => {
						this.holdQueue = false;
						this.nextCommand();
						// if (err) {
						// 	return rejectAndNext(err);
						// }

						// return resolveAndNext();
					});
					deferred.resolve(cmd.stream);
					break;
			}
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

	async stat(path: string): Promise<Stats> {
		return this.enqueue({ cmd: 'stat', path });
	}

	exists(path: string): Promise<boolean> {
		return this.stat(path).then(() => true, () => false);
	}

	async unlink(path: string, recursive = false): Promise<void> {
		const stats = await this.stat(path);
		if (stats.isFile) {
			return this.enqueue({ cmd: 'rmfile', path });
		} else {
			return this.enqueue({ cmd: 'rmdir', path, recursive });
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		return this.enqueue({ cmd: 'copy', source, destination });
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		return this.enqueue({ cmd: 'rename', oldPath, newPath });
	}

	async createReadStream(path: string): Promise<Readable> {
		const exists = await this.exists(path);
		if (exists === false) {
			throw new FileNotFound();
		}

		return this.enqueue({ cmd: 'get', path });
	}

	async createWriteStream(path: string, overwrite?: boolean): Promise<Writable> {
		const exists = await this.exists(path);
		if (exists) {
			if (overwrite !== true) {
				throw new FileAlreadyExists();
			}
		}
		
		const stream = new Transform({
			transform(chunk, encoding, done) {
				this.push(chunk);
				done();
			}
		});
		return this.enqueue({ cmd: 'put', path, stream });
	}

	createDirectory(path: string, recursive?: boolean): Promise<void> {
		return this.enqueue({ cmd: 'mkdir', path, recursive });
	}

	readDirectory(path: string): Promise<string[]>
	readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>
	readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		if (stat !== true) {
			return this.enqueue({ cmd: 'ls', path });
		} else {
			return this.enqueue({ cmd: 'ls-stat', path });
		}
	}

}