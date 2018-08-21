"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("@konstellio/fs");
const promised_1 = require("@konstellio/promised");
const ssh2_1 = require("ssh2");
const stream_1 = require("stream");
const path_1 = require("path");
const fs_2 = require("fs");
function normalizePath(path) {
    path = path.split(path_1.sep).join('/').trim();
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
var SFTPConnectionState;
(function (SFTPConnectionState) {
    SFTPConnectionState[SFTPConnectionState["Disconnecting"] = 0] = "Disconnecting";
    SFTPConnectionState[SFTPConnectionState["Closed"] = 1] = "Closed";
    SFTPConnectionState[SFTPConnectionState["Connecting"] = 2] = "Connecting";
    SFTPConnectionState[SFTPConnectionState["Ready"] = 3] = "Ready";
})(SFTPConnectionState = exports.SFTPConnectionState || (exports.SFTPConnectionState = {}));
class FileSystemSFTP extends fs_1.FileSystem {
    constructor(options) {
        super();
        this.options = options;
        this.disposed = false;
        this.connectionState = SFTPConnectionState.Closed;
        this.pool = new promised_1.Pool([{}]);
    }
    clone() {
        return new FileSystemSFTP(this.options);
    }
    getConnection() {
        return new Promise((resolve, reject) => {
            if (this.connectionState === SFTPConnectionState.Disconnecting) {
                return reject(new Error(`Filesystem is currently disconnecting.`));
            }
            else if (this.connectionState === SFTPConnectionState.Ready) {
                return resolve([this.connection, this.sftp]);
            }
            else if (this.connectionState === SFTPConnectionState.Closed) {
                this.connection = new ssh2_1.Client();
                this.connection.on('end', () => {
                    this.connectionState = SFTPConnectionState.Closed;
                });
                this.connection.on('ready', () => {
                    this.connection.sftp((err, sftp) => {
                        if (err) {
                            // return this.connection!.destroy();
                            return;
                        }
                        this.connectionState = SFTPConnectionState.Ready;
                        this.sftp = sftp;
                        this.connection.emit('sftpready');
                    });
                });
            }
            const onReady = () => {
                this.connection.removeListener('error', onError);
                resolve([this.connection, this.sftp]);
            };
            const onError = (err) => {
                this.connection.removeListener('sftpready', onReady);
                reject(new fs_1.CouldNotConnect(err));
            };
            this.connection.once('sftpready', onReady);
            this.connection.once('error', onError);
            if (this.connectionState !== SFTPConnectionState.Connecting) {
                this.connectionState = SFTPConnectionState.Connecting;
                this.connection.connect(this.options);
            }
        });
    }
    isDisposed() {
        return this.disposed;
    }
    disposeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.disposed === false) {
                this.disposed = true;
                this.connectionState = SFTPConnectionState.Disconnecting;
                if (this.connection) {
                    this.connection.destroy();
                    this.connection = undefined;
                }
                this.pool.dispose();
                this.queue = undefined;
                this.queueMap = undefined;
                this.pool = undefined;
            }
        });
    }
    stat(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            return new Promise((resolve, reject) => {
                sftp.stat(normalizePath(path), (err, stat) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(new fs_1.Stats(stat.isFile(), stat.isDirectory(), stat.isSymbolicLink(), stat.size, new Date(stat.atime), new Date(stat.mtime), new Date(stat.mtime)));
                    }
                    this.pool.release(token);
                });
            });
        });
    }
    exists(path) {
        return this.stat(path).then(() => true, () => false);
    }
    unlink(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.stat(path);
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            if (stats.isFile) {
                return new Promise((resolve, reject) => {
                    sftp.unlink(normalizePath(path), (err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                        this.pool.release(token);
                    });
                });
            }
            else if (stats.isDirectory) {
                return new Promise((resolve, reject) => {
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
                        }
                        else {
                            resolve();
                        }
                        this.pool.release(token);
                    });
                    // }
                });
            }
        });
    }
    copy() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new fs_1.OperationNotSupported('copy');
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
        });
    }
    rename(oldPath, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            return new Promise((resolve, reject) => {
                sftp.rename(normalizePath(oldPath), normalizePath(newPath), (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                    this.pool.release(token);
                });
            });
        });
    }
    createReadStream(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            return new Promise((resolve) => {
                const readStream = sftp.createReadStream(normalizePath(path));
                readStream.on('end', () => this.pool.release(token));
                readStream.on('error', () => this.pool.release(token));
                resolve(readStream);
            });
        });
    }
    createWriteStream(path, overwrite) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield this.exists(path);
            if (exists) {
                if (overwrite !== true) {
                    throw new fs_1.FileAlreadyExists();
                }
            }
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            const stream = new stream_1.Transform({
                transform(chunk, _, done) {
                    this.push(chunk);
                    done();
                }
            });
            return new Promise((resolve) => {
                const writeStream = stream.pipe(sftp.createWriteStream(normalizePath(path)));
                writeStream.on('finish', () => this.pool.release(token));
                writeStream.on('error', () => this.pool.release(token));
                resolve(writeStream);
            });
        });
    }
    createDirectory(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            return new Promise((resolve, reject) => {
                sftp.mkdir(normalizePath(path), (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                    this.pool.release(token);
                });
            });
        });
    }
    readDirectory(path, stat) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const [, sftp] = yield this.getConnection();
            return new Promise((resolve, reject) => {
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
                        new fs_1.Stats((entry.attrs.mode & fs_2.constants.S_IFREG) > 0, (entry.attrs.mode & fs_2.constants.S_IFDIR) > 0, (entry.attrs.mode & fs_2.constants.S_IFLNK) > 0, entry.attrs.size, new Date(entry.attrs.atime), new Date(entry.attrs.mtime), new Date(entry.attrs.mtime))
                    ]));
                    this.pool.release(token);
                });
            });
        });
    }
}
exports.FileSystemSFTP = FileSystemSFTP;
//# sourceMappingURL=FileSystemSFTP.js.map