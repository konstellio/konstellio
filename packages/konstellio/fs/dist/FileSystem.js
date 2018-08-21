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
const assert = require("assert");
const stream_1 = require("stream");
const promised_1 = require("@konstellio/promised");
class Stats {
    constructor(isFile, isDirectory, isSymbolicLink, size, atime, mtime, ctime) {
        this.isFile = isFile;
        this.isDirectory = isDirectory;
        this.isSymbolicLink = isSymbolicLink;
        this.size = size;
        this.atime = atime;
        this.mtime = mtime;
        this.ctime = ctime;
    }
}
exports.Stats = Stats;
const ZeroBuffer = Buffer.alloc(0);
class FileSystem {
    createEmptyFile(path) {
        return this.createWriteStream(path)
            .then((stream) => new Promise((resolve, reject) => {
            stream.on('error', (err) => reject(err));
            stream.on('end', () => setTimeout(() => resolve(), 100));
            stream.end(ZeroBuffer);
        }));
    }
}
exports.FileSystem = FileSystem;
class FileSystemMirror extends FileSystem {
    constructor(fss) {
        super();
        this.fss = fss;
        assert(fss.length > 1, `Expected at least two file system.`);
        this.disposed = false;
        this.pool = new promised_1.Pool(fss);
    }
    isDisposed() {
        return this.disposed;
    }
    disposeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDisposed() === false) {
                this.disposed = true;
                this.pool.dispose();
                this.fss = [];
                this.pool = undefined;
            }
        });
    }
    clone() {
        return new FileSystemMirror(this.fss);
    }
    stat(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            const stat = yield fs.stat(path);
            this.pool.release(fs);
            return stat;
        });
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            const exists = yield fs.exists(path);
            this.pool.release(fs);
            return exists;
        });
    }
    unlink(path, recursive) {
        return Promise.all(this.fss.map(fs => fs.unlink(path, recursive))).then(() => { });
    }
    copy(source, destination) {
        return Promise.all(this.fss.map(fs => fs.copy(source, destination))).then(() => { });
    }
    rename(oldPath, newPath) {
        return Promise.all(this.fss.map(fs => fs.copy(oldPath, newPath))).then(() => { });
    }
    readDirectory(path, stat) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            const entries = yield fs.readDirectory(path, stat === true);
            this.pool.release(fs);
            return entries;
        });
    }
    createDirectory(path, recursive) {
        return Promise.all(this.fss.map(fs => fs.createDirectory(path, recursive))).then(() => { });
    }
    createReadStream(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            const stream = yield fs.createReadStream(path);
            stream.on('end', () => this.pool.release(fs));
            stream.on('error', () => this.pool.release(fs));
            return stream;
        });
    }
    createWriteStream(path, overwrite) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = new stream_1.Transform({
                transform(chunk, _, done) {
                    this.push(chunk);
                    done();
                }
            });
            for (const fs of this.fss) {
                const writeStream = yield fs.createWriteStream(path, overwrite);
                stream.pipe(writeStream);
            }
            return stream;
        });
    }
}
exports.FileSystemMirror = FileSystemMirror;
class FileSystemPool extends FileSystem {
    constructor(fss) {
        super();
        this.fss = fss;
        assert(fss.length > 0, `Expected at least one file system.`);
        this.disposed = false;
        this.pool = new promised_1.Pool(fss);
    }
    isDisposed() {
        return this.disposed;
    }
    disposeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDisposed() === false) {
                this.disposed = true;
                this.pool.dispose();
                this.fss = [];
                this.pool = undefined;
            }
        });
    }
    clone() {
        return new FileSystemPool(this.fss);
    }
    stat(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const stat = yield fs.stat(path);
                this.pool.release(fs);
                return stat;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const exists = yield fs.exists(path);
                this.pool.release(fs);
                return exists;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    unlink(path, recursive) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const unlink = yield fs.unlink(path, recursive);
                this.pool.release(fs);
                return unlink;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    copy(source, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const copy = yield fs.copy(source, destination);
                this.pool.release(fs);
                return copy;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    rename(oldPath, newPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const rename = yield fs.rename(oldPath, newPath);
                this.pool.release(fs);
                return rename;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    readDirectory(path, stat) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const entries = yield fs.readDirectory(path, stat === true);
                this.pool.release(fs);
                return entries;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    createDirectory(path, recursive) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const mkdir = yield fs.createDirectory(path, recursive);
                this.pool.release(fs);
                return mkdir;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    createReadStream(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const stream = yield fs.createReadStream(path);
                stream.on('end', () => this.pool.release(fs));
                stream.on('error', () => this.pool.release(fs));
                return stream;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
    createWriteStream(path, overwrite) {
        return __awaiter(this, void 0, void 0, function* () {
            const fs = yield this.pool.acquires();
            try {
                const stream = yield fs.createWriteStream(path, overwrite);
                stream.on('finish', () => this.pool.release(fs));
                stream.on('error', () => this.pool.release(fs));
                return stream;
            }
            catch (err) {
                this.pool.release(fs);
                throw err;
            }
        });
    }
}
exports.FileSystemPool = FileSystemPool;
//# sourceMappingURL=FileSystem.js.map