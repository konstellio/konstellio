import 'mocha';
import { use, expect, should } from 'chai';
use(require('chai-as-promised'));
should();
import { FileSystemFTP } from '../src/FileSystemFTP';
import { FtpSrv } from 'ftp-srv';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Stats, OperationNotSupported } from '@konstellio/fs';
import { Readable, Writable } from 'stream';

describe('FTP', () => {
	let ftpd: FtpSrv;

	before(() => {
		const tmp = mkdtempSync(join(tmpdir(), 'konstellio-ftp-'));
		mkdirSync(join(tmp, 'Griffin'));
		writeFileSync(join(tmp, 'Griffin/Peter.txt'), 'Peter Griffin');
		writeFileSync(join(tmp, 'Griffin/Lois.txt'), 'Lois Pewterachmidt');
		writeFileSync(join(tmp, 'Griffin/Stewie.txt'), 'Stewie Griffin');

		ftpd = new FtpSrv('ftp://127.0.0.1:2121');
		(ftpd as any).log.level('fatal');
		ftpd.on('login', (_, resolve) => {
			resolve({ root: tmp, cwd: '/' });
		});
		return ftpd.listen();
	});

	after(async () => {
		await fs.dispose();
		await ftpd.close();
	});

	const fs = new FileSystemFTP({
		host: '127.0.0.1',
		port: 2121,
	});

	it('can stat a directory', async () => {
		const stats = await fs.stat('Griffin');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read a directory', async () => {
		const children = await fs.readDirectory('Griffin');
		expect(children).to.deep.equal(['Lois.txt', 'Peter.txt', 'Stewie.txt']);
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
			stream.on('end', () => resolve(Buffer.concat(chunks)));
		});

		expect(data).to.be.an.instanceOf(Buffer);
		expect(data.toString('utf8')).to.equal('Peter Griffin');
	}).timeout(10000);
	it('can write file', async () => {
		const writeStream = await fs.createWriteStream('Griffin/Christ.txt');
		expect(writeStream).to.be.an.instanceof(Writable);

		await new Promise<void>(resolve => {
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
			readStream.on('end', () => resolve(Buffer.concat(chunks)));
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
		} catch (err) {
			expect(err).to.be.an.instanceof(OperationNotSupported);
		}
	});
});
