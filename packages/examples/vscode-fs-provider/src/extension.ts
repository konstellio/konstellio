'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as kfs from '@konstellio/fs';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { FileNotFound, FileAlreadyExists, SFTPFileSystem, SSH2FileSystem, FTPFileSystem } from '@konstellio/fs';
import { parse as parseUrl } from 'url';
import { parse as parseQuery } from 'querystring';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const provider = new KonstellioFileSystemProvider();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftp', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftps', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('sftp', provider, { isCaseSensitive: true }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}

class KonstellioFileSystemProvider implements vscode.FileSystemProvider {

	private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
	private _drivers: Map<string, Promise<kfs.FileSystem>>;
	private _showInputBoxTail: Promise<string | undefined>;

	constructor() {
		this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

		this._drivers = new Map();
		this._showInputBoxTail = Promise.resolve(undefined);
	}

	chainShowInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string | undefined> {
		this._showInputBoxTail = this._showInputBoxTail.then(() => vscode.window.showInputBox(options, token), () => vscode.window.showInputBox(options, token));
		return this._showInputBoxTail;
	}

	getDriver(uri: vscode.Uri): Promise<kfs.FileSystem> {
		const hash = `${uri.scheme}://${uri.authority}?${uri.query}#${uri.fragment}`;
		if (this._drivers.has(hash) === false) {
			this._drivers.set(hash, new Promise((resolve, _reject) => {
				const reject = (reason?: any) => {
					this._drivers.delete(hash);
					return _reject(reason);
				};

				const url = parseUrl(uri.toString(true));
				const query = parseQuery(url.query);
				const auth = (url.auth || '').split(':');
				const user = auth.shift();
				let pass: string | undefined = auth.join(':');
				let passphrase: string | undefined;

				// TODO: resolve with password/passphrase...

				// if (query.promptPassword) {
				// 	console.log('prompt pass', user);
				// 	pass = await this.chainShowInputBox({
				// 		prompt: `Enter password for ${user}@${url.hostname}`
				// 	});
				// 	if (pass === undefined) {
				// 		return reject(vscode.FileSystemError.Unavailable(`Needs a password.`));
				// 	}
				// 	console.log('pass', user, pass);
				// }

				// if (query.promptPassphrase) {
				// 	console.log('prompt passphrase', user);
				// 	passphrase = await this.chainShowInputBox({
				// 		prompt: `Enter passphrase for ${user}@${url.hostname}`
				// 	});
				// 	if (passphrase === undefined) {
				// 		return reject(vscode.FileSystemError.Unavailable(`Needs a passphrase.`));
				// 	}
				// 	console.log('passphrase', user, passphrase);
				// }

				switch (uri.scheme) {
					case 'ftp':
					case 'ftps':
						return resolve(new FTPFileSystem({
							host: url.hostname,
							port: parseInt(url.port || '21'),
							user: user,
							password: pass,
							connTimeout: parseInt(query.timeout || '10000'),
							pasvTimeout: parseInt(query.timeout || '10000'),
							keepalive: parseInt(query.keepalive || '10000'),
							secure: uri.scheme === 'ftps' ? true : undefined,
							// secureOptions: {},
						}));
					case 'sftp':
						if (query.sudo) {
							return resolve(new SSH2FileSystem({
								host: url.hostname,
								port: parseInt(url.port || '22'),
								username: user,
								password: pass ? pass : undefined,
								privateKey: query.privateKey ? readFileSync(query.privateKey) : undefined,
								readyTimeout: parseInt(query.timeout || '10000'),
								sudo: ['1', 'true'].indexOf(query.sudo) > -1 ? true : query.sudo,
								passphrase: passphrase,
							}));
						} else {
							return resolve(new SFTPFileSystem({
								host: url.hostname,
								port: parseInt(url.port || '22'),
								username: user,
								password: pass ? pass : undefined,
								privateKey: query.privateKey ? readFileSync(query.privateKey) : undefined,
								readyTimeout: parseInt(query.timeout || '10000'),
								passphrase: passphrase,
							}));
						}
					default:
						return reject(vscode.FileSystemError.Unavailable());
				}
			}));
		}
		return this._drivers.get(hash)!;
	}

	dispose() {
		for (const [, promise] of this._drivers) {
			promise.then(driver => driver.disposeAsync());
		}
	}

	get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
		return this._onDidChangeFile.event;
	}

	watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
		return { dispose: () => {} };
	}

	async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
		try {
			const driver = await this.getDriver(uri);
			const stats = await driver.stat(uri.path);
			return new FileStat(stats);
		}
		catch (err) {
			handleError(err, uri);
			throw vscode.FileSystemError.FileNotFound(uri);
		}
	}

	async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		try {
			const driver = await this.getDriver(uri);
			const exists = await driver.exists(uri.path);
			if (exists === false) {
				throw vscode.FileSystemError.FileNotFound(uri);
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
		catch (err) {
			handleError(err, uri);
			throw vscode.FileSystemError.Unavailable(uri);
		}
	}

	async createDirectory(uri: vscode.Uri): Promise<void> {
		try {
			const driver = await this.getDriver(uri);
			const exists = await driver.exists(uri.path);
			if (exists === true) {
				return;
			}

			await driver.createDirectory(uri.path, true);
		}
		catch (err) {
			handleError(err, uri);
			throw vscode.FileSystemError.Unavailable(uri);
		}
	}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		try {
			const driver = await this.getDriver(uri);
			const exists = await driver.exists(uri.path);
			if (exists === false) {
				throw vscode.FileSystemError.FileNotFound(uri);
			}

			const stats = await driver.stat(uri.path);
			if (stats.isFile !== true) {
				throw vscode.FileSystemError.FileNotADirectory(uri);
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
		catch (err) {
			handleError(err, uri);
			throw vscode.FileSystemError.Unavailable(uri);
		}
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
		try {
			const driver = await this.getDriver(uri);
			const exists = await driver.exists(uri.path);
			if (exists === false) {
				if (options.create === false) {
					throw vscode.FileSystemError.FileNotFound(uri);
				}

				await this.createDirectory(uri.with({ path: dirname(uri.path) }));
			} else {
				if (options.overwrite === false) {
					throw vscode.FileSystemError.FileExists(uri);
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
		catch (err) {
			handleError(err, uri);
			throw vscode.FileSystemError.Unavailable(uri);
		}
	}

	async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
		
		try {
			const driver = await this.getDriver(uri);
			const exists = await driver.exists(uri.path);
			if (exists === false) {
				throw vscode.FileSystemError.FileNotFound(uri);
			}

			await driver.unlink(uri.path, options.recursive);
		}
		catch (err) {
			handleError(err, uri);
			throw vscode.FileSystemError.Unavailable(uri);
		}
	}

	async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
		try {
			const driver = await this.getDriver(oldUri);
			const exists = await driver.exists(newUri.path);
			if (exists === true) {
				if (options.overwrite === false) {
					throw vscode.FileSystemError.FileExists(newUri);
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
		catch (err) {
			handleError(err, oldUri);
			throw vscode.FileSystemError.Unavailable(oldUri);
		}
	}

	async copy(source: vscode.Uri, destination: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
		try {
			const driver = await this.getDriver(source);
			const exists = await driver.exists(destination.path);
			if (exists === true) {
				if (options.overwrite === false) {
					throw vscode.FileSystemError.FileExists(destination);
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
		catch (err) {
			handleError(err, source);
			throw vscode.FileSystemError.Unavailable(source);
		}
	}

}

function handleError(error: Error, uri?: vscode.Uri): void {
	if (error instanceof FileNotFound) {
		throw vscode.FileSystemError.FileNotFound(uri);
	}
	else if (error instanceof FileAlreadyExists) {
		throw vscode.FileSystemError.FileExists(uri);
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