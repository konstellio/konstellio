import { FileSystem, Stats, FileNotFound, FileAlreadyExists, CouldNotConnect } from '@konstellio/fs';
import { Pool } from '@konstellio/promised';
import { Client } from 'ssh2';
import { Readable, Writable } from 'stream';
import { sep } from 'path';
import { parseEntries } from 'parse-listing';

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

export enum SSH2ConnectionState {
	Disconnecting,
	Closed,
	Connecting,
	Ready
}

export interface FileSystemSSHAlgorithms {
	kex?: string[];
	cipher?: string[];
	serverHostKey?: string[];
	hmac?: string[];
	compress?: string[];
}

export interface FileSystemSSHOptions {
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
	algorithms?: FileSystemSSHAlgorithms;
	debug?: (information: string) => any;
	sudo?: boolean | string;
}

export class FileSystemSSH extends FileSystem {

	private disposed: boolean;
	protected connection?: Client;
	protected connectionState: SSH2ConnectionState;
	private pool: Pool;

	constructor(
		protected readonly options: FileSystemSSHOptions
	) {
		super();
		this.disposed = false;
		this.connectionState = SSH2ConnectionState.Closed;
		this.pool = new Pool([{}]);
	}

	clone() {
		return new FileSystemSSH(this.options);
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
					this.connectionState = SSH2ConnectionState.Ready;
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

			if (this.connectionState !== SSH2ConnectionState.Connecting) {
				this.connectionState = SSH2ConnectionState.Connecting;
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
			this.connectionState = SSH2ConnectionState.Disconnecting;
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

	protected getSudo() {
		return this.options.sudo === true
			? `sudo -s `
			: typeof this.options.sudo === 'string'
				? `sudo -i -u ${this.options.sudo} `
				: '';
	}

	protected async exec (conn: Client, cmd: string): Promise<[number | null, string | undefined, Buffer]> {
		return new Promise<[number | null, string | undefined, Buffer]>((resolve, reject) => {
			const sudo = this.getSudo();

			conn.exec(sudo + cmd, (err, stream) => {
				if (err) {
					return reject(err);
				}

				const chunks: Buffer[] = [];

				stream.on('exit', (code, signal) => {
					return resolve([code, signal, Buffer.concat(chunks)]);
				});

				stream.on('data', (chunk: Buffer) => {
					chunks.push(chunk);
				});
			});
		});
	}

	async stat(path: string): Promise<Stats> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		const [code, , stat] = await this.exec(conn, `stat "${normalizePath(path)}"`);
		this.pool.release(token);
		if (code === 1) {
			throw new FileNotFound(path);
		} else {
			return parseStat(stat.toString('utf8'));
		}
	}

	exists(path: string): Promise<boolean> {
		return this.stat(path).then(() => true, () => false);
	}

	async unlink(path: string, recursive = false): Promise<void> {
		const stats = await this.stat(path);
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		if (stats.isFile) {
			await this.exec(conn, `rm -f "${normalizePath(path)}"`);
			// TODO: check error ?
			this.pool.release(token);
		}
		else if (stats.isDirectory && recursive) {
			await this.exec(conn, `rm -fr "${normalizePath(path)}"`);
			// TODO: check error ?
			this.pool.release(token);
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		await this.exec(conn, `cp -r "${normalizePath(source)}" "${normalizePath(destination)}"`);
		// TODO: check error ?
		this.pool.release(token);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		await this.exec(conn, `mv "${normalizePath(oldPath)}" "${normalizePath(newPath)}"`);
		// TODO: check error ?
		this.pool.release(token);
	}

	async createReadStream(path: string): Promise<Readable> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		const sudo = this.getSudo();
		return new Promise<Readable>((resolve, reject) => {
			conn.exec(`${sudo}cat "${normalizePath(path)}"`, (err, chan) => {
				if (err) {
					reject(err);
					this.pool.release(token);
					return;
				}
				chan.on('end', () => this.pool.release(token));
				chan.on('error', () => this.pool.release(token));
				resolve(chan);
			});
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
		const conn = await this.getConnection();

		// const stream = new Transform({
		// 	transform(chunk, encoding, done) {
		// 		this.push(chunk);
		// 		done();
		// 	}
		// });

		const sudo = this.getSudo();

		return new Promise<Writable>((resolve, reject) => {
			// conn.exec(`${sudo}cat > "${normalizePath(cmd.path)}"`, (err, chan) => {
			// conn.exec(`${sudo}cat | ${sudo}tee "${normalizePath(cmd.path)}"`, (err, chan) => {
			conn.exec(`${sudo}bash -c 'cat > "${normalizePath(path)}"'`, (err, chan) => {
				if (err) {
					reject(err);
					this.pool.release(token);
					return;
				}

				chan.on('finish', () => this.pool.release(token));
				chan.on('error', () => this.pool.release(token));
				resolve(chan);
			});
		});
	}

	async createDirectory(path: string, recursive?: boolean): Promise<void> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		await this.exec(conn, `mkdir ${recursive === true ? '-p' : ''} "${normalizePath(path)}"`);
		// TODO: check error ?
		this.pool.release(token);
	}

	async readDirectory(path: string): Promise<string[]>;
	async readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>;
	async readDirectory(path: string, stat?: boolean): Promise<(string | [string, Stats])[]> {
		const token = await this.pool.acquires();
		const conn = await this.getConnection();
		const [, , ls] = await this.exec(conn, `ls -la "${normalizePath(path)}"`);
		return new Promise<(string | [string, Stats])[]>((resolve, reject) => {
			parseEntries(ls.toString('utf8'), (err, entries) => {
				if (err) {
					reject(err);
				} else {
					if (stat !== true) {
						resolve(entries.map((entry) => entry.name));
					} else {
						resolve(entries.map((entry) => [
							entry.name,
							new Stats(
								entry.type === 0,
								entry.type === 1,
								entry.type === 2,
								parseInt(entry.size, 10),
								new Date(entry.time),
								new Date(entry.time),
								new Date(entry.time)
							)
						]) as [string, Stats][]);
					}
				}
				this.pool.release(token);
			});
		});
	}
}

export default FileSystemSSH;

function parseStat(stat: string): Stats {
	let size: number = 0;
	let atime: number = 0;
	let mtime: number = 0;
	let ctime: number = 0;
	let type: string = '-';

	let match;

	if ((match = stat.match(/Size: (\d+)/))) {
		size = parseInt(match[1], 10);
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