import 'mocha';
import { use, expect, should } from 'chai';
use(require('chai-as-promised'));
should();
import { Pool } from '../src/Pool';
import { Readable, Writable } from 'stream';

describe('Pool', () => {
	it('instanciate', async () => {
		const a = {
			count: 0,
			inc() {
				this.count = (this.count || 0) + 1;
			},
		};
		const b = {
			count: 0,
			inc() {
				this.count = (this.count || 0) + 1;
			},
		};
		const c = {
			count: 0,
			inc() {
				this.count = (this.count || 0) + 1;
			},
		};

		const g = new Pool([a, b, c]);

		let t = await g.acquires();
		expect(t).to.eq(a);

		t.inc();
		g.release(t);

		expect(a.count).to.eq(1);
		expect(b.count).to.eq(0);
		expect(c.count).to.eq(0);

		t = await g.acquires();
		expect(t).to.eq(b);
	});

	it('defer', async () => {
		const a = {
			count: 0,
			inc() {
				this.count = (this.count || 0) + 1;
			},
		};
		// const b = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
		// const c = { count: 0, inc() { this.count = (this.count || 0) + 1; } };

		const g = new Pool();

		setTimeout(() => g.release(a), 1000);

		const t = await g.acquires();
		expect(t).to.eq(a);
	});

	// it('transform', async () => {
	// 	const g = new Pool(['a', 'b', 'c']);

	// 	const transform = g.transform({
	// 		highWaterMark: 1,
	// 		objectMode: true
	// 	}, async (chunk, consumer) => {
	// 		// await wait(Math.random() * 3000 + 500);
	// 		await wait(Math.random() * 1000);
	// 		return chunk + consumer;
	// 	});

	// 	let i = 10;
	// 	const readable = new Readable({
	// 		objectMode: true,
	// 		read() {
	// 			if (--i >= 0) {
	// 				return this.push(i);
	// 			}
	// 			return this.push(null);
	// 		}
	// 	});

	// 	const out = new Writable({
	// 		objectMode: true,
	// 		write(chunk, encoding, done) {
	// 			console.log(chunk);
	// 			done();
	// 		}
	// 	});

	// 	await new Promise((resolve, reject) => {
	// 		readable.pipe(transform).pipe(out);
	// 		out.on('finish', resolve);
	// 		out.on('error', reject);
	// 	});

	// });
});

async function wait(time = 0) {
	return new Promise(resolve => setTimeout(resolve, time));
}
