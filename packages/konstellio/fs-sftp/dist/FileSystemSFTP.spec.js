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
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const fs = require("fs");
const FileSystemSFTP_1 = require("./FileSystemSFTP");
const SFTPServer = require("node-sftp-server");
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const FileSystem_spec_1 = require("@konstellio/fs/dist/FileSystem.spec");
describe('SFTP', () => {
    let sftpd;
    before(() => {
        const tmp = fs_1.mkdtempSync(path_1.join(os_1.tmpdir(), 'konstellio-sftp-'));
        fs_1.mkdirSync(path_1.join(tmp, 'Griffin'));
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
        fs_1.writeFileSync(path_1.join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
        fs_1.writeFileSync(path_1.join(tmp, 'ssh_host_rsa_key'), `-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQC57UB/5H0M+t+mopksrltCCIXghryzofJjau+8tuMT9CG6ta3S
O9aKApJUUG/xtc88giVhB7HFABX/oob+jrkSthR8s/whULC8E+GhvOBjHydRUZIs
aPYOMBb42HcbOsgq3li/hwOcDk0vY00hZDKCum9BgvRAb7dPEkw2dmiCQQIDAQAB
AoGAMG+HOwoaLbR5aR64yrQNYBF6Vvii1iUdURr9o2r9kygpVUuZIcim5kMvPbnK
v+w+NaQt+q4XeJvCH1uG0W/69FwnphfaOVmCCUtsoJ6sU3fWr9x59MtKL2Llh8xR
50lz6R+eDXoYRDq245hG9BFn/bu0vtqQqx06mlZJcjaRocECQQDjdYFmr+DSww3x
VNx0G0DUkaQZZ+iqZiT3Zund2pcBB4aLiewOrqj0GFct4+YNzgxIXPejmS0eSokN
N2lC3NxZAkEA0UGjN5TG5/LEK3zcYtx2kpXryenrYORo1n2L/WPMZ0mjLQyd4LJr
ibfgVUfwX/kV3vgGYLwjpgcaTiMsecv4KQJAYMmMgZSPdz+WvD1e/WznXkyG5mSn
xXJngnrhQw0TulVodBIBR5IcxJli510VdIRcB6K/oXa5ky0mOmB8wv3WKQJBAKEF
PxE//KbzWhyUogm4180IbD4dMDCI0ltqlFRRfTJlqZi6wqnq4XFB+u/kwYU4aKoA
dPfvDgduI8HIsyqt17ECQDI/HC8PiYsDIOyVpQuQdIAsbGmoavK7X1MVEWR2nj9t
7BbUVFSnVKynL4TWIJZ6xP8WQwkDBQc5WjognHDaUTQ=
-----END RSA PRIVATE KEY-----`);
        sftpd = new SFTPServer({
            privateKeyFile: path_1.join(tmp, 'ssh_host_rsa_key'),
            debug: false
        });
        sftpd.listen(2222);
        sftpd.on('connect', (auth) => {
            auth.accept((session) => {
                session.on('realpath', (path, done) => __awaiter(this, void 0, void 0, function* () {
                    return done(path === '.' ? '/' : path);
                }));
                session.on('stat', (path, _, resp) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const stat = fs.statSync(path_1.join(tmp, path));
                        if (stat.isDirectory()) {
                            resp.is_directory();
                        }
                        else {
                            resp.is_file();
                        }
                        resp.permissions = stat.mode;
                        resp.uid = stat.uid;
                        resp.gid = stat.gid;
                        resp.size = stat.size;
                        resp.atime = stat.atime.getTime();
                        resp.mtime = stat.mtime.getTime();
                        resp.file();
                    }
                    catch (err) {
                        resp.nofile();
                    }
                }));
                session.on('readdir', (path, resp) => {
                    try {
                        const entries = fs.readdirSync(path_1.join(tmp, path));
                        let i = 0;
                        resp.on('dir', () => {
                            if (entries[i]) {
                                const stat = fs.statSync(path_1.join(tmp, path, entries[i]));
                                resp.stopped = resp.sftpStream.name(resp.req, {
                                    filename: entries[i],
                                    longname: `${stat.isDirectory() ? 'd' : '-'}rw-r--r--   1 nobody  nobody  ${stat.size}  3 Oct 20:31 ${entries[i]}`,
                                    attrs: {
                                        mode: stat.isDirectory()
                                            ? fs.constants.S_IFDIR | 0o644
                                            : fs.constants.S_IFREG | 0o644,
                                        permissions: stat.mode,
                                        uid: stat.uid,
                                        gid: stat.gid,
                                        size: stat.size,
                                        atime: stat.atime.getTime(),
                                        mtime: stat.mtime.getTime()
                                    }
                                });
                                if (!resp.stopped && !resp.done) {
                                    resp.emit("dir");
                                }
                            }
                            else {
                                resp.end();
                            }
                            ++i;
                        });
                    }
                    catch (err) {
                        resp.nofile();
                    }
                });
                session.on('readfile', (path, writestream) => {
                    return fs.createReadStream(path_1.join(tmp, path)).pipe(writestream);
                });
                session.on('writefile', (path, readstream) => {
                    const writestream = fs.createWriteStream(path_1.join(tmp, path));
                    readstream.pipe(writestream);
                });
                session.on('delete', (path, cb) => {
                    fs.unlink(path_1.join(tmp, path), (err) => {
                        if (err) {
                            return cb.fail();
                        }
                        cb.ok();
                    });
                });
                session.on('rename', (oldPath, newPath, cb) => {
                    fs.rename(path_1.join(tmp, oldPath), path_1.join(tmp, newPath), (err) => {
                        if (err) {
                            return cb.fail();
                        }
                        cb.ok();
                    });
                });
                session.on('mkdir', (path, cb) => {
                    fs.mkdir(path_1.join(tmp, path), (err) => {
                        if (err) {
                            return cb.fail();
                        }
                        cb.ok();
                    });
                });
                session.on('rmdir', (path, cb) => {
                    fs.rmdir(path_1.join(tmp, path), (err) => {
                        if (err) {
                            return cb.fail();
                        }
                        cb.ok();
                    });
                });
            });
        });
    });
    const fssftp = new FileSystemSFTP_1.FileSystemSFTP({
        host: '127.0.0.1',
        port: 2222,
        username: '',
        password: ''
    });
    FileSystem_spec_1.shouldBehaveLikeAFileSystem(fssftp);
    after(() => __awaiter(this, void 0, void 0, function* () {
        yield fssftp.disposeAsync();
        yield new Promise(resolve => sftpd.server.close(() => resolve()));
    }));
});
//# sourceMappingURL=FileSystemSFTP.spec.js.map