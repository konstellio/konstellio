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
const path_1 = require("path");
const parse_listing_1 = require("parse-listing");
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
var SSH2ConnectionState;
(function (SSH2ConnectionState) {
    SSH2ConnectionState[SSH2ConnectionState["Disconnecting"] = 0] = "Disconnecting";
    SSH2ConnectionState[SSH2ConnectionState["Closed"] = 1] = "Closed";
    SSH2ConnectionState[SSH2ConnectionState["Connecting"] = 2] = "Connecting";
    SSH2ConnectionState[SSH2ConnectionState["Ready"] = 3] = "Ready";
})(SSH2ConnectionState = exports.SSH2ConnectionState || (exports.SSH2ConnectionState = {}));
class FileSystemSSH extends fs_1.FileSystem {
    constructor(options) {
        super();
        this.options = options;
        this.disposed = false;
        this.connectionState = SSH2ConnectionState.Closed;
        this.pool = new promised_1.Pool([{}]);
    }
    clone() {
        return new FileSystemSSH(this.options);
    }
    getConnection() {
        return new Promise((resolve, reject) => {
            if (this.connectionState === SSH2ConnectionState.Disconnecting) {
                return reject(new Error(`Filesystem is currently disconnecting.`));
            }
            else if (this.connectionState === SSH2ConnectionState.Ready) {
                return resolve(this.connection);
            }
            else if (this.connectionState === SSH2ConnectionState.Closed) {
                this.connection = new ssh2_1.Client();
                this.connection.on('end', () => {
                    this.connectionState = SSH2ConnectionState.Closed;
                });
                this.connection.on('ready', () => {
                    this.connectionState = SSH2ConnectionState.Ready;
                    ;
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
            if (this.connectionState !== SSH2ConnectionState.Connecting) {
                this.connectionState = SSH2ConnectionState.Connecting;
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
                this.connectionState = SSH2ConnectionState.Disconnecting;
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
    getSudo() {
        return this.options.sudo === true
            ? `sudo -s `
            : typeof this.options.sudo === 'string'
                ? `sudo -i -u ${this.options.sudo} `
                : '';
    }
    exec(conn, cmd) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const sudo = this.getSudo();
                conn.exec(sudo + cmd, (err, stream) => {
                    if (err) {
                        return reject(err);
                    }
                    const chunks = [];
                    stream.on('exit', (code, signal) => {
                        return resolve([code, signal, Buffer.concat(chunks)]);
                    });
                    stream.on('data', (chunk) => {
                        chunks.push(chunk);
                    });
                });
            });
        });
    }
    ;
    stat(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            const [code, , stat] = yield this.exec(conn, `stat "${normalizePath(path)}"`);
            this.pool.release(token);
            if (code === 1) {
                throw new fs_1.FileNotFound(path);
            }
            else {
                return parseStat(stat.toString('utf8'));
            }
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
                yield this.exec(conn, `rm -f "${normalizePath(path)}"`);
                // TODO: check error ?
                this.pool.release(token);
            }
            else if (stats.isDirectory && recursive) {
                yield this.exec(conn, `rm -fr "${normalizePath(path)}"`);
                // TODO: check error ?
                this.pool.release(token);
            }
        });
    }
    copy(source, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            yield this.exec(conn, `cp -r "${normalizePath(source)}" "${normalizePath(destination)}"`);
            // TODO: check error ?
            this.pool.release(token);
        });
    }
    rename(oldPath, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            yield this.exec(conn, `mv "${normalizePath(oldPath)}" "${normalizePath(newPath)}"`);
            // TODO: check error ?
            this.pool.release(token);
        });
    }
    createReadStream(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            const sudo = this.getSudo();
            return new Promise((resolve, reject) => {
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
            // const stream = new Transform({
            // 	transform(chunk, encoding, done) {
            // 		this.push(chunk);
            // 		done();
            // 	}
            // });
            const sudo = this.getSudo();
            return new Promise((resolve, reject) => {
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
        });
    }
    createDirectory(path, recursive) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            yield this.exec(conn, `mkdir ${recursive === true ? '-p' : ''} "${normalizePath(path)}"`);
            // TODO: check error ?
            this.pool.release(token);
        });
    }
    readDirectory(path, stat) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.pool.acquires();
            const conn = yield this.getConnection();
            const [, , ls] = yield this.exec(conn, `ls -la "${normalizePath(path)}"`);
            return new Promise((resolve, reject) => {
                parse_listing_1.parseEntries(ls.toString('utf8'), (err, entries) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        if (stat !== true) {
                            resolve(entries.map((entry) => entry.name));
                        }
                        else {
                            resolve(entries.map((entry) => [
                                entry.name,
                                new fs_1.Stats(entry.type === 0, entry.type === 1, entry.type === 2, parseInt(entry.size), new Date(entry.time), new Date(entry.time), new Date(entry.time))
                            ]));
                        }
                    }
                    this.pool.release(token);
                });
            });
        });
    }
}
exports.FileSystemSSH = FileSystemSSH;
function parseStat(stat) {
    let size = 0;
    let atime = 0;
    let mtime = 0;
    let ctime = 0;
    let type = '-';
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
    return new fs_1.Stats(type === '-', type === 'd', type === 'l', size, new Date(atime), new Date(mtime), new Date(ctime));
}
//# sourceMappingURL=FileSystemSSH.js.map