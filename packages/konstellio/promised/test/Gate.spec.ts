import 'mocha';
import { use, expect, should } from 'chai';
use(require('chai-as-promised'));
should();
import { Gate } from '../src/Gate';

describe('Gate', () => {
	it('instanciate', () => {
		const g = new Gate();
		expect(g.isOpened()).to.eq(false);
		g.open();
		expect(g.isOpened()).to.eq(true);
		g.close();
		expect(g.isOpened()).to.eq(false);
	});

	it('gate', async () => {
		const g = new Gate();
		let t = 0;

		setTimeout(() => g.open(), 1000);

		expect(t).to.eq(0);

		await g.wait();
		t += 1;

		expect(t).to.eq(1);

		await g.wait();
		t += 1;

		expect(t).to.eq(2);
	});
});
