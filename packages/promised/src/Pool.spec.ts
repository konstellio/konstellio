import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { Pool } from './Pool';

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
		const b = { count: 0, inc() { this.count = (this.count || 0) + 1; } };
		const c = { count: 0, inc() { this.count = (this.count || 0) + 1; } };

		const g = new Pool();

		setTimeout(() => g.release(a), 1000);

		let t = await g.acquires();
		expect(t).to.eq(a);
	});
	

});