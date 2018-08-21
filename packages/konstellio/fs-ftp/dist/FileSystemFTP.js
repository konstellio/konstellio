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
const FTPClient = require("ftp");
const stream_1 = require("stream");
const path_1 = require("path");
function normalizePath(path) {
    path = path.split(path_1.sep).join('/').trim();
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
var FTPConnectionState;
(function (FTPConnectionState) {
    FTPConnectionState[FTPConnectionState["Disconnecting"] = 0] = "Disconnecting";
    FTPConnectionState[FTPConnectionState["Closed"] = 1] = "Closed";
    FTPConnectionState[FTPConnectionState["Connecting"] = 2] = "Connecting";
    FTPConnectionState[FTPConnectionState["Ready"] = 3] = "Ready";
})(FTPConnectionState = exports.FTPConnectionState || (exports.FTPConnectionState = {}));
class FileSystemFTP extends fs_1.FileSystem {
    constructor(options) {
        super();
        this.options = options;
        this.disposed = false;
        this.connectionState = FTPConnectionState.Closed;
        this.pool = new promised_1.Pool([{}]);
    }
    clone() {
        return new FileSystemFTP(this.options);
    }
    getConnection() {
        return new Promise((resolve, reject) => {
            if (this.connectionState === FTPConnectionState.Disconnecting) {
                return reject(new Error(`Filesystem is currently disconnecting.`));
            }
            else if (this.connectionState === FTPConnectionState.Ready) {
                return resolve(this.connection);
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
                this.connection.removeListener('error', onError);
                resolve(this.connection);
            };
            const onError = (err) => {
                this.connection.removeListener('ready', onReady);
                reject(new fs_1.CouldNotConnect(err));
            };
            this.connection.once('ready', onReady);
            this.connection.once('error', onError);
            if (this.connectionState !== FTPConnectionState.Connecting) {
                this.connectionState = FTPConnectionState.Connecting;
                this.connection.connect(this.options);
            }
        });
    }
    isDisposed() {
        return this.disposed;
    }
    disposeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.disposed) {
                this.disposed = true;
                this.connectionState = FTPConnectionState.Disconnecting;
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
            const normalized = normalizePath(path);
            if (normalized === '/') {
                return new fs_1.Stats(false, true, false, 0, new Date(), new Date(), new Date());
            }
            const filename = path_1.basename(normalized);
            const entries = yield this.readDirectory(path_1.dirname(normalized), true);
            const entry = entries.find(([name]) => name === filename);
            if (entry) {
                return entry[1];
            }
            throw new fs_1.FileNotFound(path);
        });
    }
    exists(path) {
        return this.stat(path).then(() => true, () => false);
    }
    unlink(path, recursive = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.stat(path);
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            if (stats.isFile) {
                return new Promise((resolve, reject) => {
                    conn.delete(normalizePath(path), (err) => {
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
                    conn.rmdir(normalizePath(path), recursive, (err) => {
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
        });
    }
    copy() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new fs_1.OperationNotSupported('copy');
        });
    }
    rename(oldPath, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            return new Promise((resolve, reject) => {
                conn.rename(normalizePath(oldPath), normalizePath(newPath), (err) => {
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
            const conn = yield this.getConnection();
            return new Promise((resolve, reject) => {
                conn.get(normalizePath(path), (err, stream) => {
                    if (err) {
                        reject(err);
                        this.pool.release(token);
                        return;
                    }
                    stream.on('finish', () => this.pool.release(token));
                    stream.on('error', () => this.pool.release(token));
                    resolve(stream);
                });
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
            const conn = yield this.getConnection();
            const stream = new stream_1.Transform({
                transform(chunk, _, done) {
                    this.push(chunk);
                    done();
                }
            });
            return new Promise((resolve) => {
                conn.put(stream, normalizePath(path), () => this.pool.release(token));
                resolve(stream);
            });
        });
    }
    createDirectory(path, recursive) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            return new Promise((resolve, reject) => {
                conn.mkdir(normalizePath(path), recursive === true, (err) => {
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
            const conn = yield this.getConnection();
            return new Promise((resolve, reject) => {
                conn.list(normalizePath(path), (err, entries) => {
                    if (err) {
                        reject(err);
                        this.pool.release(token);
                        return;
                    }
                    entries = entries.filter(entry => entry.name !== '.' && entry.name !== '..');
                    if (stat !== true) {
                        resolve(entries.map(entry => entry.name));
                        this.pool.release(token);
                        return;
                    }
                    resolve(entries.map(entry => [
                        entry.name,
                        new fs_1.Stats(entry.type === '-', entry.type === 'd', entry.type === 'l', parseInt(entry.size, 10), entry.date, entry.date, entry.date)
                    ]));
                    this.pool.release(token);
                });
            });
        });
    }
}
exports.FileSystemFTP = FileSystemFTP;
//# sourceMappingURL=FileSystemFTP.js.map