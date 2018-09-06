import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { Pool } from '../src/Pool';

describe('Pool', () => {

	it('instanciate', async () => {

		const a = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
		const b = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
		const c = { count: 0, inc() { this.count = (this.count || 0) + 1; } };

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
		const a = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
		// const b = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
		// const c = { count: 0, inc() { this.count = (this.count || 0) + 1; } };

		const g = new Pool();

		setTimeout(() => g.release(a), 1000);

		const t = await g.acquires();
		expect(t).to.eq(a);
	});

	it('iterate', async () => {

		const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
		const pool = new Pool(['a','b','c']);
		
		expect(pool.size).to.equal(3);

		for await (const s of pool.iterate(items[Symbol.iterator](), async (i, c) => {
			await new Promise(resolve => setTimeout(resolve, (Math.random() * 5) * 200));
			return i + c;

		})) {
			// console.log('state', s);
		}

		expect(pool.size).to.equal(3);
	});

});