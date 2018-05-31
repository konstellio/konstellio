import { FileSystem, Stats, FileSystemQueued, QueuedCommand } from '../FileSystem';
import Deferred from '../Deferred';
import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { Duplex, Readable, Writable, Transform } from 'stream';
import { join, dirname, basename, sep } from 'path';
import { FileNotFound, OperationNotSupported, FileAlreadyExists } from '../Errors';
import { constants } from 'fs';
import { parseEntries, parseEntry } from 'parse-listing';

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

export enum SSH2ConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready
}

export interface SSH2FileSystemOptions extends ConnectConfig {
	sudo?: boolean | string
}

export class SSH2FileSystem extends FileSystemQueued {

	private disposed: boolean;
	protected connection?: Client;
	protected connectionState: SSH2ConnectionState;

	constructor(
		protected readonly options: SSH2FileSystemOptions
	) {
		super();
		this.disposed = false;
		this.connectionState = SSH2ConnectionState.Closed;
	}

	clone() {
		return new SSH2FileSystem(this.options);
	}

	protected getConnection(): Promise<Client> {
		return new Promise((resolve, reject) => {
			if (this.connectionState === SSH2ConnectionState.Disconnecting) {
				return reject(new Error(`Filesystem is currently disconnecting.`));
			}
			else if (this.connectionState === SSH2ConnectionState.Ready) {
				return resolve(this.connection!);
			}
			else if (this.connectionState === SSH2ConnectionState.Closed) {
				this.connection = new Client();
				this.connection.on('end', () => {
					this.connectionState = SSH2ConnectionState.Closed;
				});
				this.connection.on('ready', () => {
					this.connectionState = SSH2ConnectionState.Ready;;
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

			if (this.connectionState !== SSH2ConnectionState.Connecting) {
				this.connectionState = SSH2ConnectionState.Connecting;
				this.connection!.connect(this.options);
			}
		});
	}

	protected async processCommand(cmd: QueuedCommand, resolve: (value?: any) => void | Promise<void>, reject: (reason?: any) => void | Promise<void>, next: () => void | Promise<void>): Promise<void> {

		const conn = await this.getConnection();

		const exec = async (cmd: string): Promise<[number | null, string | undefined, Buffer]> => {
			return new Promise<[number | null, string | undefined, Buffer]>((resolve, reject) => {
				conn.exec(cmd, (err, stream) => {
					if (err) {
						return reject(err);
					}

					const chunks: Buffer[] = [];

					stream.on('exit', (code, signal) => {
						return resolve([code, signal, Buffer.concat(chunks)]);
					});

					stream.on('data', chunk => {
						chunks.push(chunk);
					});
				})
			});
		};

		const sudo = this.options.sudo === true
			? `sudo -s `
			: typeof this.options.sudo === 'string'
				? `sudo -i -u ${this.options.sudo} `
				: ''

		switch (cmd.cmd) {
			case 'stat':
				try {
					const [code, signal, stat] = await exec(`${sudo}stat "${normalizePath(cmd.path)}"`);
					if (code === 1) {
						reject(new FileNotFound(cmd.path));
					} else {
						resolve(parseStat(stat.toString('utf8')));
					}
				} catch (err) {
					reject(err);
				}
				next();
				break;
			case 'ls':
			case 'ls-stat':
				try {
					const [, , ls] = await exec(`${sudo}ls -la "${normalizePath(cmd.path)}"`);
					parseEntries(ls.toString('utf8'), (err, entries) => {
						if (err) {
							reject(err);
						} else {
							if (cmd.cmd === 'ls') {
								resolve(entries.map(entry => entry.name));
							} else {
								resolve(entries.map(entry => [
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
								]));
							}
						}
						return next();
					});
				} catch (err) {
					reject(err);
					next();
				}
				break;
			case 'rmfile':
				try {
					await exec(`${sudo}rm -f "${normalizePath(cmd.path)}"`);
					resolve();
				} catch (err) {
					reject(err);
				}
				next();
				break;
			case 'rmdir':
				try {
					await exec(`${sudo}rm -fr "${normalizePath(cmd.path)}"`);
					resolve();
				} catch (err) {
					reject(err);
				}
				next();
				break;
			case 'mkdir':
				try {
					await exec(`${sudo}mkdir ${cmd.recursive === true ? '-p' : ''} "${normalizePath(cmd.path)}"`);
					resolve();
				} catch (err) {
					reject(err);
				}
				next();
				break;
			case 'rename':
				try {
					await exec(`${sudo}mv "${normalizePath(cmd.oldPath)}" "${normalizePath(cmd.newPath)}"`);
					resolve();
				} catch (err) {
					reject(err);
				}
				next();
				break;
			case 'copy':
				try {
					await exec(`${sudo}cp -r "${normalizePath(cmd.source)}" "${normalizePath(cmd.destination)}"`);
					resolve();
				} catch (err) {
					reject(err);
				}
				next();
				break;
			case 'get':
				conn.exec(`${sudo}cat "${normalizePath(cmd.path)}"`, (err, chan) => {
					if (err) {
						reject(err);
						return next();
					}
					chan.on('end', next);
					chan.on('error', next);
					resolve(chan);
				});
				break;
			case 'put':
				// conn.exec(`${sudo}cat > "${normalizePath(cmd.path)}"`, (err, chan) => {
				// conn.exec(`${sudo}cat | ${sudo}tee "${normalizePath(cmd.path)}"`, (err, chan) => {
				conn.exec(`${sudo}bash -c 'cat > "${normalizePath(cmd.path)}"'`, (err, chan) => {
					if (err) {
						reject(err);
						return next();
					}

					chan.on('finish', next);
					chan.on('error', next);
					resolve(chan);
				});
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
			this.connectionState = SSH2ConnectionState.Disconnecting;
			if (this.connection) {
				this.connection!.destroy();
				(this as any).connection = undefined;
			}
			(this as any).queue = undefined;
			(this as any).queueMap = undefined;
		}
	}

}

function parseStat(stat: string): Stats {
	let size: number = 0;
	let atime: number = 0;
	let mtime: number = 0;
	let ctime: number = 0;
	let type: string = '-';

	let match;

	if ((match = stat.match(/Size: (\d+)/))) {
		size = parseInt(match[1]);
	}
	if ((match = stat.match(/Access: \(\d+\/(.)/))) {
		type = match[1];
	}
	if ((match = stat.match(/Access: ([0-9_ :.-]+)/))) {
		atime = Date.parse(match[1]);
	}
	if ((match = stat.match(/Modify: ([0-9_ :.-]+)/))) {
		mtime = Date.parse(match[1]);
	}
	if ((match = stat.match(/Change: ([0-9_ :.-]+)/))) {
		ctime = Date.parse(match[1]);
	}

	return new Stats(
		type === '-',
		type === 'd',
		type === 'l',
		size,
		new Date(atime),
		new Date(mtime),
		new Date(ctime)
	);
}