import { FileSystem, Stats } from './FileSystem';
import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { Readable, Writable } from 'stream';
import { ReadStream, WriteStream } from 'fs';

export function shouldBehaveLikeAFileSystem (fs: FileSystem) {
	it('can stat a file', async () => {
		const stats = await fs.stat('Griffin/Peter.txt');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read file', async () => {
		const stream = await fs.createReadStream('Griffin/Peter.txt');
		expect(stream).to.be.an.instanceof(ReadStream);

		const data = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			stream.on('error', err => reject(err));
			stream.on('data', chunk => chunks.push(chunk as Buffer));
			stream.on('close', () => resolve(Buffer.concat(chunks)));
		});

		expect(data).to.be.an.instanceOf(Buffer);
		expect(data.toString('utf8')).to.equal('Peter Griffin');
	});
	it('can write file', async () => {
		const writeStream = await fs.createWriteStream('Griffin/Christ.txt');
		expect(writeStream).to.be.an.instanceof(WriteStream);

		await new Promise<void>((resolve, reject) => {
			writeStream.end(Buffer.from('Christ Griffin'), (err) => {
				if (err) return reject(err);
				return resolve();
			});
		});

		const readStream = await fs.createReadStream('Griffin/Christ.txt');
		expect(readStream).to.be.an.instanceof(ReadStream);

		const data = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			readStream.on('error', err => reject(err));
			readStream.on('data', chunk => chunks.push(chunk as Buffer));
			readStream.on('close', () => resolve(Buffer.concat(chunks)));
		});

		expect(data).to.be.an.instanceOf(Buffer);
		expect(data.toString('utf8')).to.equal('Christ Griffin');
	});
	it('can rename file', async () => {
		await fs.createEmptyFile('Griffin/Christ.txt');
		await fs.rename('Griffin/Christ.txt', 'Griffin/Christ2.txt');

		const exists = await fs.exists('Griffin/Christ.txt');
		expect(exists).to.equal(false);
	});
	it('can copy file', async () => {
		await fs.copy('Griffin/Peter.txt', 'Griffin/Peter2.txt');

		const exists = await fs.exists('Griffin/Peter.txt');
		expect(exists).to.equal(true);
	});
	it('can stat a directory', async () => {
		const stats = await fs.stat('Griffin');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read a directory', async () => {
		const children = await fs.readDirectory('Griffin');
		expect(children).to.deep.equal([
			'Christ2.txt',
			'Lois.txt',
			'Peter.txt',
			'Peter2.txt',
			'Stewie.txt'
		]);
	}).timeout(10000);
}