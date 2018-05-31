import { IDisposableAsync } from '@konstellio/disposable';
import { ReadStream, WriteStream } from "fs";
import { join, normalize, basename, dirname, sep } from 'path';
import { Readable, Writable, Transform } from 'stream';
import Deferred from './Deferred';
import { FileNotFound, FileAlreadyExists } from './Errors';

export class Stats {

	public constructor(
		public readonly isFile: boolean,
		public readonly isDirectory: boolean,
		public readonly isSymbolicLink: boolean,
		public readonly size: number,
		public readonly atime: Date,
		public readonly mtime: Date,
		public readonly ctime: Date
	) {

	}

}

const ZeroBuffer = new Buffer(0);

export abstract class FileSystem implements IDisposableAsync {
	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract clone(): FileSystem
	abstract stat(path: string): Promise<Stats>
	abstract exists(path: string): Promise<boolean>
	abstract unlink(path: string, recursive?: boolean): Promise<void>
	abstract copy(source: string, destination: string): Promise<void>
	abstract rename(oldPath: string, newPath: string): Promise<void>
	abstract readDirectory(path: string): Promise<string[]>
	abstract readDirectory(path: string, stat: boolean): Promise<[string, Stats][]>

	createEmptyFile(path: string): Promise<void> {
		return this.createWriteStream(path)
		.then((stream) => new Promise<void>((resolve, reject) => {
			stream.on('error', (err) => reject(err));
			stream.on('end', () => setTimeout(() => resolve(), 100));
			stream.end(ZeroBuffer);
		}));
	}

	abstract createDirectory(path: string, recursive?: boolean): Promise<void>
	abstract createReadStream(path: string): Promise<Readable>
	abstract createWriteStream(path: string, overwrite?: boolean): Promise<Writable>
}

export interface QueuedCommandPromise {
	cmd: QueuedCommand
	deferred: Deferred<any>
}

export type QueuedCommand = 
	QueuedCommandStat | 
	QueuedCommandList | 
	QueuedCommandListStat | 
	QueuedCommandCreateFile | 
	QueuedCommandCreateDirectory | 
	QueuedCommandRemoveFile | 
	QueuedCommandRemoveDirectory | 
	QueuedCommandCopy | 
	QueuedCommandRename | 
	QueuedCommandDownload | 
	QueuedCommandUpload;

export interface QueuedCommandStat { cmd: 'stat', path: string, filename?: string }
export interface QueuedCommandList { cmd: 'ls', path: string }
export interface QueuedCommandListStat { cmd: 'ls-stat', path: string }
export interface QueuedCommandCreateFile { cmd: 'mkfile', path: string }
export interface QueuedCommandCreateDirectory { cmd: 'mkdir', path: string, recursive?: boolean }
export interface QueuedCommandRemoveFile { cmd: 'rmfile', path: string }
export interface QueuedCommandRemoveDirectory { cmd: 'rmdir', path: string, recursive?: boolean }
export interface QueuedCommandCopy { cmd: 'copy', source: string, destination: string }
export interface QueuedCommandRename { cmd: 'rename', oldPath: string, newPath: string }
export interface QueuedCommandDownload { cmd: 'get', path: string }
export interface QueuedCommandUpload { cmd: 'put', path: string, stream: Readable }

export abstract class FileSystemQueued extends FileSystem {

	protected queue: QueuedCommandPromise[];
	protected queueMap: Map<string, QueuedCommandPromise>;
	protected holdQueue: boolean;

	constructor() {
		super();
		this.holdQueue = false;
		this.queue = [];
		this.queueMap = new Map();
	}

	abstract isDisposed(): boolean
	abstract disposeAsync(): Promise<void>
	abstract clone(): FileSystemQueued

	protected async enqueue(cmd: QueuedCommandStat): Promise<Stats>
	protected async enqueue(cmd: QueuedCommandList): Promise<string[]>
	protected async enqueue(cmd: QueuedCommandListStat): Promise<[string, Stats][]>
	protected async enqueue(cmd: QueuedCommandCreateFile): Promise<void>
	protected async enqueue(cmd: QueuedCommandCreateDirectory): Promise<void>
	protected async enqueue(cmd: QueuedCommandRemoveFile): Promise<void>
	protected async enqueue(cmd: QueuedCommandRemoveDirectory): Promise<void>
	protected async enqueue(cmd: QueuedCommandCopy): Promise<void>
	protected async enqueue(cmd: QueuedCommandRename): Promise<void>
	protected async enqueue(cmd: QueuedCommandDownload): Promise<Readable>
	protected async enqueue(cmd: QueuedCommandUpload): Promise<Writable>
	protected async enqueue(cmd: QueuedCommand): Promise<any> {
		const hash = JSON.stringify(cmd);
		if (this.queueMap.has(hash)) {
			return this.queueMap.get(hash)!.deferred;
		}
		const cmdDeferred: QueuedCommandPromise = {
			cmd,
			deferred: new Deferred<any>()
		};

		cmdDeferred.deferred.then(() => this.queueMap.delete(hash), () => this.queueMap.delete(hash));

		this.queue.push(cmdDeferred);
		this.queueMap.set(hash, cmdDeferred);

		this.nextCommand();

		return cmdDeferred.deferred;
	}

	protected async nextCommand(): Promise<void> {
		if (this.holdQueue === true) {
			return;
		}

		const item = this.queue.shift();
		if (item) {
			this.holdQueue = true;

			const { cmd, deferred } = item;

			const resolve = (value?: any) => {
				return deferred.resolve(value);
			};
			const reject = (reason?: any) => {
				return deferred.reject(reason);
			};
			const next = () => {
				this.holdQueue = false;
				this.nextCommand();
			};

			return this.processCommand(cmd, resolve, reject, next);
		}
	}

	protected abstract processCommand(cmd: QueuedCommand, resolve: (value?: any) => void | Promise<void>, reject: (reason?: any) => void | Promise<void>, next: () => void | Promise<void>): Promise<void>;

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
			throw new FileNotFound(path);
		}

		return this.enqueue({ cmd: 'get', path });
	}

	async createWriteStream(path: string, overwrite?: boolean): Promise<Writable> {
		const exists = await this.exists(path);
		if (exists) {
			if (overwrite !== true) {
				throw new FileAlreadyExists(path);
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