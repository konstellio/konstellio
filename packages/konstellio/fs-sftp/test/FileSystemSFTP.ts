import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { mkdtempSync, mkdirSync, writeFileSync, statSync, readdirSync, constants, createWriteStream, createReadStream, unlink, rename, mkdir, rmdir } from 'fs';
import { FileSystemSFTP } from '../src/FileSystemSFTP';
import * as SFTPServer from 'node-sftp-server';
import { tmpdir } from 'os';
import { join } from 'path';
import { Writable, Readable } from 'stream';
import { Stats, OperationNotSupported } from '@konstellio/fs';

describe('SFTP', () => {

	let sftpd: any;

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
						const stat = statSync(join(tmp, path));
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
				});
				session.on('readdir', (path: string, resp: any) => {
					try {
						const entries = readdirSync(join(tmp, path));
						let i = 0;
						resp.on('dir', () => {
							if (entries[i]) {
								const stat = statSync(join(tmp, path, entries[i]));
								resp.stopped = resp.sftpStream.name(resp.req, {
									filename: entries[i],
									longname: `${stat.isDirectory() ? 'd' : '-'}rw-r--r--   1 nobody  nobody  ${stat.size}  3 Oct 20:31 ${entries[i]}`,
									attrs: {
										mode: stat.isDirectory()
											? constants.S_IFDIR | 0o644
											: constants.S_IFREG | 0o644,
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
					return createReadStream(join(tmp, path)).pipe(writestream);
				});
				session.on('writefile', (path: string, readstream: Readable) => {
					const writestream = createWriteStream(join(tmp, path));
					readstream.pipe(writestream);
				});
				session.on('delete', (path: string, cb: any) => {
					unlink(join(tmp, path), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
				session.on('rename', (oldPath: string, newPath: string, cb: any) => {
					rename(join(tmp, oldPath), join(tmp, newPath), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
				session.on('mkdir', (path: string, cb: any) => {
					mkdir(join(tmp, path), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
				session.on('rmdir', (path: string, cb: any) => {
					rmdir(join(tmp, path), (err) => {
						if (err) {
							return cb.fail();
						}
						cb.ok();
					});
				});
			});
		});
	});

	after(async () => {
		await fs.disposeAsync();
		await new Promise(resolve => sftpd.server.close(() => resolve()));
	});

	const fs = new FileSystemSFTP({
		host: '127.0.0.1',
		port: 2222,
		username: '',
		password: ''
	});

	it('can stat a directory', async () => {
		const stats = await fs.stat('Griffin');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read a directory', async () => {
		const children = await fs.readDirectory('Griffin');
		expect(children).to.deep.equal([
			'Lois.txt',
			'Peter.txt',
			'Stewie.txt'
		]);
	}).timeout(10000);
	it('can stat a file', async () => {
		const stats = await fs.stat('Griffin/Peter.txt');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read file', async () => {
		const stream = await fs.createReadStream('Griffin/Peter.txt');
		expect(stream).to.be.an.instanceof(Readable);

		const data = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			stream.on('error', err => reject(err));
			stream.on('data', chunk => chunks.push(chunk as Buffer));
			stream.on('close', () => resolve(Buffer.concat(chunks)));
		});

		expect(data).to.be.an.instanceOf(Buffer);
		expect(data.toString('utf8')).to.equal('Peter Griffin');
	}).timeout(10000);
	it('can write file', async () => {
		const writeStream = await fs.createWriteStream('Griffin/Christ.txt');
		expect(writeStream).to.be.an.instanceof(Writable);

		await new Promise<void>((resolve) => {
			writeStream.end(Buffer.from('Christ Griffin'), 'utf8', () => {
				return resolve();
			});
		});

		const readStream = await fs.createReadStream('Griffin/Christ.txt');
		expect(readStream).to.be.an.instanceof(Readable);

		const data = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			readStream.on('error', err => reject(err));
			readStream.on('data', chunk => chunks.push(chunk as Buffer));
			readStream.on('close', () => resolve(Buffer.concat(chunks)));
		});

		expect(data).to.be.an.instanceOf(Buffer);
		expect(data.toString('utf8')).to.equal('Christ Griffin');
	}).timeout(10000);
	it('can rename file', async () => {
		await fs.rename('Griffin/Peter.txt', 'Griffin/Peter2.txt');

		const exists = await fs.exists('Griffin/Peter.txt');
		expect(exists).to.equal(false);
	});
	it('can copy file', async () => {
		try {
			await fs.copy('Griffin/Lois.txt', 'Griffin/Lois2.txt');

			const exists = await fs.exists('Griffin/Lois.txt');
			expect(exists).to.equal(true);
		}
		catch (err) {
			expect(err).to.be.an.instanceof(OperationNotSupported);
		}
	});

});