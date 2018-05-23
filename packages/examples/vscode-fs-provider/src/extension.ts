'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as kfs from '@konstellio/fs';
import { dirname } from 'path';
import { FTPFileSystem } from '@konstellio/fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// const folders = vscode.workspace.workspaceFolders;
	// if (folders) {
	// 	for (const folder of folders) {
	// 		if (folder.uri.scheme === 'local') {
	// 			const provider = new KonstellioFileSystemProvider(folder.uri);
	// 			const disposable = vscode.workspace.registerFileSystemProvider('local', provider, { isCaseSensitive: process.platform === 'linux' });
	// 			context.subscriptions.push(disposable);
	// 		}
	// 	}
	// }

	const provider = new KonstellioFileSystemProvider();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('kfslocal', provider, { isCaseSensitive: process.platform === 'linux' }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('kfsftp', provider, { isCaseSensitive: true }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}

class KonstellioFileSystemProvider implements vscode.FileSystemProvider {

	private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
	private _drivers: Map<string, kfs.FileSystem>;

	constructor() {
		this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

		this._drivers = new Map();
	}

	getDriver(uri: vscode.Uri): kfs.FileSystem {
		const hash = uri.scheme + uri.authority;
		if (this._drivers.has(hash) === false) {
			switch (uri.scheme) {
				case 'kfslocal':
					this._drivers.set(hash, new kfs.LocalFileSystem(''));
					break;
				case 'kfsftp':
					this._drivers.set(hash, new FTPFileSystem({
						// ...
					}));
					break;
				default:
					throw vscode.FileSystemError.Unavailable;
			}
		}
		return this._drivers.get(hash)!;
	}

	get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
		return this._onDidChangeFile.event;
	}

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
		return { dispose: () => {} };
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		const driver = this.getDriver(uri);
		try {
			const stats = await driver.stat(uri.path);
			return new FileStat(stats);
		}
		catch (err) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const driver = this.getDriver(uri);
		const exists = await driver.exists(uri.path);
		if (exists === false) {
			throw vscode.FileSystemError.FileNotFound;
		}

		const children = await driver.readDirectory(uri.path, true);
		const results = children.map(([path, stats]) => [
			path,
			stats.isFile
				? vscode.FileType.File
				: stats.isDirectory
					? vscode.FileType.Directory
					: vscode.FileType.SymbolicLink
		] as [string, vscode.FileType]);

		return results;
	}

	async createDirectory(uri: vscode.Uri): Promise<void> {
		await this.getDriver(uri).createDirectory(uri.path, true);
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const driver = this.getDriver(uri);

		const exists = await driver.exists(uri.path);
		if (exists === false) {
			throw vscode.FileSystemError.FileNotFound;
		}

		const stats = await driver.stat(uri.path);
		if (stats.isFile !== true) {
			throw vscode.FileSystemError.FileNotADirectory();
		}
		const readStream = await driver.createReadStream(uri.path);
		const data = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			readStream.on('error', (err: Error) => reject(err));
			readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
			readStream.on('close', () => resolve(Buffer.concat(chunks)));
		});
		return data;
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
		const driver = this.getDriver(uri);

		const exists = await driver.exists(uri.path);
		if (exists === false) {
			if (options.create === false) {
				throw vscode.FileSystemError.FileNotFound();
			}

			await driver.createDirectory(dirname(uri.path));
		} else {
			if (options.overwrite === false) {
				throw vscode.FileSystemError.FileExists();
			}
		}

		const writeStream = await driver.createWriteStream(uri.path, options.overwrite);

		await new Promise<void>((resolve, reject) => {
			writeStream.end(content, (err: Error) => {
				if (err) {
					return reject(err);
				}
				return resolve();
			});
		});
	}

	async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
		const driver = this.getDriver(uri);

		const exists = await driver.exists(uri.path);
		if (exists === false) {
			throw vscode.FileSystemError.FileNotFound;
		}
		
		await driver.unlink(uri.path, options.recursive);
	}

	async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
		const driver = this.getDriver(oldUri);

		const exists = await driver.exists(newUri.path);
		if (exists === true) {
			if (options.overwrite === false) {
				throw vscode.FileSystemError.FileExists();
			}
			else {
				await this.delete(newUri, { recursive: true });
			}
		}

		const parentExists = await driver.exists(dirname(newUri.path));
		if (parentExists === false) {
			await this.createDirectory(newUri.with({ path: dirname(newUri.path) }));
		}

		await driver.rename(oldUri.path, newUri.path);
	}

	async copy(source: vscode.Uri, destination: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
		const driver = this.getDriver(source);

		const exists = await driver.exists(destination.path);
		if (exists === true) {
			if (options.overwrite === false) {
				throw vscode.FileSystemError.FileExists();
			}
			else {
				await this.delete(destination, { recursive: true });
			}
		}

		const parentExists = await driver.exists(dirname(destination.path));
		if (parentExists === false) {
			await this.createDirectory(destination.with({ path: dirname(destination.path) }));
		}

		await driver.copy(source.path, destination.path);
	}

}

export class FileStat implements vscode.FileStat {

	constructor(
		private _stats: kfs.Stats
	) {  }

	get type(): vscode.FileType {
		if (this._stats.isFile) {
			return vscode.FileType.File;
		}
		else if (this._stats.isDirectory) {
			return vscode.FileType.Directory;
		}
		return vscode.FileType.SymbolicLink;
	}

	get isFile(): boolean | undefined {
		return this._stats.isFile;
	}

	get isDirectory(): boolean | undefined {
		return this._stats.isDirectory;
	}

	get isSymbolicLink(): boolean | undefined {
		return this._stats.isSymbolicLink;
	}

	get size(): number {
		return this._stats.size;
	}

	get ctime(): number {
		return this._stats.ctime.getTime();
	}

	get mtime(): number {
		return this._stats.mtime.getTime();
	}
}