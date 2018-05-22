import { Driver, Stats } from './Driver';
import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { Readable, Writable } from 'stream';
import { ReadStream, WriteStream } from 'fs';

export function driverShouldBehaveLikeAFileSystem (driver: Driver) {
	it('can stat a file', async () => {
		const stats = await driver.stat('Griffin/Peter.txt');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read file', async () => {
		const stream = driver.createReadStream('Griffin/Peter.txt');
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
		const writeStream = driver.createWriteStream('Griffin/Christ.txt');
		expect(writeStream).to.be.an.instanceof(WriteStream);

		await new Promise<void>((resolve, reject) => {
			writeStream.end(Buffer.from('Christ Griffin'), (err) => {
				if (err) return reject(err);
				return resolve();
			});
		});

		const readStream = driver.createReadStream('Griffin/Christ.txt');
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
		await driver.createFile('Griffin/Christ.txt');
		await driver.rename('Griffin/Christ.txt', 'Griffin/Christ2.txt');

		const exists = await driver.exists('Griffin/Christ.txt');
		expect(exists).to.equal(false);
	});
	it('can copy file', async () => {
		await driver.copy('Griffin/Peter.txt', 'Griffin/Peter2.txt');

		const exists = await driver.exists('Griffin/Peter.txt');
		expect(exists).to.equal(true);
	});
	it('can stat a directory', async () => {
		const stats = await driver.stat('Griffin');
		expect(stats).to.be.an.instanceof(Stats);
	});
	it('can read a directory', async () => {
		const children = await driver.readDirectory('Griffin');
		expect(children).to.deep.equal([
			'Christ2.txt',
			'Lois.txt',
			'Peter.txt',
			'Peter2.txt',
			'Stewie.txt'
		]);
	}).timeout(10000);
}