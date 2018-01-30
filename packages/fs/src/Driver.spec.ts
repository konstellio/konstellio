import { Driver, File, Directory, Stats } from './Driver';
import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { Readable, Writable } from 'stream';

export function driverShouldBehaveLikeAFileSystem (driver: Driver) {
	describe('file', () => {
		it('can be instanciate', async () => {
			expect(() => driver.file('Griffin/Peter.txt')).to.not.throw();
			expect(() => driver.file('../Peter.txt')).to.throw();
			expect(driver.file('Griffin/Peter.txt').isFile).to.equal(true);
			expect(driver.file('Griffin/Peter.txt').isDirectory).to.equal(false);
			expect(driver.file('Griffin/Peter.txt').path).to.equal('Griffin/Peter.txt');
		});
		it('can check existance of file', async () => {
			expect(driver.file('Griffin/Peter.txt').exists).to.be.a('function');

			return Promise.all([
				driver.file('Griffin/Peter.txt').exists().should.eventually.be.fulfilled.and.to.be.equal(true),
				driver.file('Griffin/Meg.txt').exists().should.eventually.be.fulfilled.and.to.be.equal(false)
			]);
		});
		/*it('can stat a file', async (done) => {
			expect(driver.file('Griffin/Peter.txt').stat).to.be.a('function');
			expect(async () => { await driver.file('Griffin/Peter.txt').stat(); }).to.not.throw().and.be.an.instanceOf(Stats);
			expect(async () => { await driver.file('Griffin/Meg.txt').stat(); console.log('what ?'); }).to.throw();
		});
		it('can read file', async () => {
			let stream: Readable;
			expect(() => { stream = driver.file('Griffin/Peter.txt').createReadStream(); }).to.not.throw();
			expect(stream!).to.be.an.instanceOf(Readable);

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
			let stream: Writable;
			expect(() => { stream = driver.file('Griffin/Christ.txt').createWriteStream(); }).to.not.throw();
			expect(stream!).to.be.an.instanceOf(Writable);

			expect(() => stream!.end(Buffer.from('Christ Griffin'))).to.not.throw();
		});*/
	});

	/*describe('directory', () => {
		it('can be instanciate', async () => {
			expect(() => driver.directory('Griffin')).to.not.throw(),
			expect(() => driver.directory('../Griffin')).to.throw(),
			expect(driver.directory('Griffin').isFile).to.equal(false),
			expect(driver.directory('Griffin').isDirectory).to.equal(true),
			expect(driver.directory('Griffin').path).to.equal('Griffin')
		});
		it('can check existance of directory', async () => {
			expect(driver.directory('Griffin').exists).to.be.a('function');
			expect(async () => { await driver.directory('Griffin').exists(); }).to.not.throw().and.be.equal(true);
			expect(async () => { await driver.directory('Simpsons').exists(); }).to.not.throw().and.be.equal(false);
		});
	});*/
}