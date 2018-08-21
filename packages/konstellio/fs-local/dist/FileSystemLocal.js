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
const fs_1 = require("fs");
const mkdirp = require("mkdirp");
const path_1 = require("path");
const fs_2 = require("@konstellio/fs");
class FileSystemLocal extends fs_2.FileSystem {
    constructor(rootDirectory, directoryMode = 0o777, fileMode = 0o644) {
        super();
        this.rootDirectory = rootDirectory;
        this.directoryMode = directoryMode;
        this.fileMode = fileMode;
        this.disposed = false;
    }
    isDisposed() {
        return this.disposed;
    }
    disposeAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.disposed === false) {
                this.disposed = true;
            }
        });
    }
    clone() {
        return new FileSystemLocal(this.rootDirectory, this.directoryMode, this.fileMode);
    }
    stat(path) {
        return new Promise((resolve, reject) => {
            fs_1.lstat(path_1.join(this.rootDirectory, path), (err, stats) => {
                if (err) {
                    return reject(err);
                }
                resolve(new fs_2.Stats(stats.isFile(), stats.isDirectory(), stats.isSymbolicLink(), stats.size, stats.atime, stats.mtime, stats.ctime));
            });
        });
    }
    exists(path) {
        return this.stat(path).then(() => true, () => false);
    }
    unlink(path, recursive = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.stat(path);
            if (stats.isFile) {
                return yield new Promise((resolve, reject) => {
                    fs_1.unlink(path_1.join(this.rootDirectory, path), (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
            else if (stats.isDirectory && recursive) {
                const children = yield this.readDirectory(path, true);
                for (const [child] of children) {
                    yield this.unlink(path_1.join(path, child), true);
                    yield new Promise((resolve, reject) => {
                        fs_1.unlink(path_1.join(path, child), (err) => {
                            if (err) {
                                return reject(err);
                            }
                            return resolve();
                        });
                    });
                }
            }
        });
    }
    copy(source, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.stat(source);
            if (stats.isFile) {
                return yield new Promise((resolve, reject) => {
                    fs_1.copyFile(path_1.join(this.rootDirectory, source), path_1.join(this.rootDirectory, destination), (err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                });
            }
            else if (stats.isDirectory) {
                debugger;
            }
        });
    }
    rename(oldPath, newPath) {
        return new Promise((resolve, reject) => {
            fs_1.rename(path_1.join(this.rootDirectory, oldPath), path_1.join(this.rootDirectory, newPath), (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
    createReadStream(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield this.exists(path);
            if (exists === false) {
                throw new fs_2.FileNotFound();
            }
            return fs_1.createReadStream(path_1.join(this.rootDirectory, path));
        });
    }
    createWriteStream(path, overwrite, encoding) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield this.exists(path);
            if (exists) {
                if (overwrite !== true) {
                    throw new fs_2.FileAlreadyExists();
                }
            }
            return fs_1.createWriteStream(path_1.join(this.rootDirectory, path), {
                mode: this.fileMode,
                encoding: encoding,
                autoClose: true
            });
        });
    }
    createDirectory(path, recursive) {
        return new Promise((resolve, reject) => {
            if (recursive) {
                mkdirp(path_1.join(this.rootDirectory, path), this.directoryMode, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }
            else {
                fs_1.mkdir(path_1.join(this.rootDirectory, path), this.directoryMode, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            }
        });
    }
    readDirectory(path, stat) {
        return new Promise((resolve, reject) => {
            fs_1.readdir(path_1.join(this.rootDirectory, path), (err, entries) => {
                if (err) {
                    return reject(err);
                }
                if (stat !== true) {
                    return resolve(entries);
                }
                Promise.all(entries.map(entry => {
                    const entryPath = path_1.join(path, entry);
                    return this.stat(entryPath);
                }))
                    .then((stats) => resolve(entries.map((entry, idx) => [entry, stats[idx]])), (err) => reject(err));
            });
        });
    }
}
exports.FileSystemLocal = FileSystemLocal;
//# sourceMappingURL=FileSystemLocal.js.map