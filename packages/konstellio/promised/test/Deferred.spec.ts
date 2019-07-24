import 'mocha';
import { use, expect, should } from 'chai';
use(require('chai-as-promised'));
should();
import { Deferred } from '../src/Deferred';

describe('Deferred', () => {
	it('instanciate', () => {
		const d = new Deferred();
		expect(d.resolve).to.be.a('function');
		expect(d.reject).to.be.a('function');
		expect(d.promise).to.be.an.instanceof(Promise);
	});

	it('defer', async () => {
		const d = new Deferred<number>();
		let t = 0;

		setTimeout(() => d.resolve(10), 1000);

		expect(t).to.eq(0);
		d.then(v => (t = v));
		expect(t).to.eq(0);

		await d.promise;

		expect(t).to.eq(10);
	});
});
