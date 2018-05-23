import { FileSystem, Stats } from '../FileSystem';
import * as FTPClient from 'ftp';
import { Duplex, Readable, Writable } from 'stream';
import { join, dirname, basename } from 'path';
import { POINT_CONVERSION_COMPRESSED } from 'constants';

const ZeroBuffer = new Buffer(0);

export enum FTPConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready
}

export class FTPFileSystem extends FileSystem {

	private disposed: boolean;
	private connection: FTPClient;
	public readonly state: FTPConnectionState;

	constructor(
		protected readonly options: FTPClient.Options
	) {
		super();
		this.disposed = false;
		this.state = FTPConnectionState.Closed;
		// (this.options as any).debug = console.log;
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

	protected getConnection(): Promise<FTPClient> {
		return new Promise((resolve, reject) => {
			if (this.state === FTPConnectionState.Ready) {
				return resolve(this.connection);
			}
			else if (this.state === FTPConnectionState.Closed) {
				this.connection = new FTPClient();
				this.connection.connect(this.options);
				// this.connection.on('error', (err) => {
				// 	console.error(err);
				// });
				this.connection.on('end', () => {
					(this as any).state = FTPConnectionState.Closed;
				});
				this.connection.on('ready', () => {
					(this as any).state = FTPConnectionState.Ready;
					// console.log('Ready');
				});
				// this.connection.on('greeting', (msg) => {
				// 	console.log(msg);
				// });
				// (this.connection as any)._parser.on('response', (code, text) => {
				// 	console.log(code, text);
				// });
			}

			const onReady = () => {
				this.connection.removeListener('end', onEnded);
				// resolve(this.connection);
				setTimeout(() => resolve(this.connection), 1000);
			};
			const onEnded = () => {
				this.connection.removeListener('ready', onReady);
				reject();
			};

			this.connection.once('ready', onReady);
			this.connection.once('end', onEnded);

			if (this.state !== FTPConnectionState.Connecting) {
				this.connection.connect(this.options);
			}
		});
	}

	async stat(path: string): Promise<Stats> {
		path = path || './';
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
		const connection = await this.getConnection();
		const stats = await this.stat(path);
		if (stats.isFile) {
			return await new Promise<void>((resolve, reject) => {
				connection.delete(path, (err) => {
					if (err) {
						return reject(err);
					}
					return resolve();
				});
			});
		}
		else if (stats.isDirectory) {
			const children = await this.readDirectory(path, true);
			for (const [child, stats] of children) {
				await this.unlink(join(path, child), true);
				await new Promise<void>((resolve, reject) => {
					connection.delete(join(path, child), (err) => {
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
		throw new Error(`Not implemented.`);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		return this.getConnection()
		.then((connection) => new Promise<void>((resolve, reject) => {
			connection.rename(oldPath, newPath, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			})
		}));
	}

	createReadStream(path: string): Promise<Readable> {
		return this.getConnection()
		.then((connection) => new Promise<Readable>((resolve, reject) => {
			connection.get(path, (err, stream) => {
				if (err) {
					return reject(err);
				}
				return resolve(stream as Readable);
			})
		}));
	}

	async createWriteStream(path: string, overwrite?: boolean, encoding?: string): Promise<Writable> {
		const connection = await this.getConnection();
		const stream = new Duplex();

		connection.put(stream, path, (err) => {
			console.error(err);
		});

		return stream;
	}

	createFile(path: string, recursive?: boolean): Promise<void> {
		return this.createWriteStream(path)
		.then((stream) => new Promise<void>((resolve, reject) => {
			stream.on('error', (err) => reject(err));
			stream.on('end', () => resolve());
			stream.end(ZeroBuffer);
		}));
	}

	createDirectory(path: string, recursive?: boolean): Promise<void> {
		return this.getConnection()
		.then((connection) => new Promise<void>((resolve, reject) => {
			connection.mkdir(path, recursive === true, (err) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			})
		}));
	}

	readDirectory(path: string): Promise<string[]>
	readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>
	readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		return this.getConnection()
		.then((connection) => new Promise<(string | [string, Stats])[]>((resolve, reject) => {
			connection.list(path, (err, entries) => {
				if (err) {
					return reject(err);
				}

				if (stat !== true) {
					return resolve(entries.map(entry => entry.name));
				}

				return resolve(entries.map(entry => [
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
		}));
	}

}