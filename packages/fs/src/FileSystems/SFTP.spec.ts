import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();
import * as fs from 'fs';
import { SFTPFileSystem } from './SFTP';
import * as SFTPServer from 'node-sftp-server';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { shouldBehaveLikeAFileSystem } from '../FileSystem.spec';
import { Writable, Readable } from 'stream';

describe('SFTP', () => {

	let sftpd: any

	before(() => {
		const tmp = mkdtempSync(join(tmpdir(), 'konstellio-sftp-'));
		mkdirSync(join(tmp, 'Griffin'));
		writeFileSync(join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
		writeFileSync(join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
		writeFileSync(join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');
		writeFileSync(join(tmp, 'ssh_host_rsa_key'), `-----BEGIN RSA PRIVATE KEY-----
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
			privateKeyFile: join(tmp, 'ssh_host_rsa_key'),
			debug: false
		});
		sftpd.listen(2222);
		sftpd.on('connect', (auth: any) => {
			auth.accept((session: any) => {
				session.on('realpath', async (path: string, done: (path: string) => void) => {
					return done(path === '.' ? '/' : path);
				});
				session.on('stat', async (path: string, _: any, resp: any) => {
					try {
						const stat = fs.statSync(join(tmp, path));
						if (stat.isDirectory()) {
							resp.is_directory();
						} else {
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
				})
				session.on('readdir', (path: string, resp: any) => {
					try {
						const entries = fs.readdirSync(join(tmp, path));
						let i = 0;
						resp.on('dir', () => {
							if (entries[i]) {
								const stat = fs.statSync(join(tmp, path, entries[i]));
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
							} else {
								resp.end();
							}
							++i;
						});
					} catch (err) {
						resp.nofile();
					}
				});
				session.on('readfile', (path: string, writestream: Writable) => {
					return fs.createReadStream(join(tmp, path)).pipe(writestream);
				});
				session.on('writefile', (path: string, readstream: Readable) => {
					const writestream = fs.createWriteStream(join(tmp, path));
					readstream.pipe(writestream);
				});
				session.on('delete', (path: string, cb: any) => {
					fs.unlink(join(tmp, path), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
				session.on('rename', (oldPath: string, newPath: string, cb: any) => {
					fs.rename(join(tmp, oldPath), join(tmp, newPath), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
				session.on('mkdir', (path: string, cb: any) => {
					fs.mkdir(join(tmp, path), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
				session.on('rmdir', (path: string, cb: any) => {
					fs.rmdir(join(tmp, path), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
			});
		});
	});

	const fssftp = new SFTPFileSystem({
		host: '127.0.0.1',
		port: 2222,
		username: '',
		password: ''
	});

	shouldBehaveLikeAFileSystem(fssftp);

	after(async () => {
		await fssftp.disposeAsync();
		await new Promise(resolve => sftpd.server.close(() => resolve()));
	});

});