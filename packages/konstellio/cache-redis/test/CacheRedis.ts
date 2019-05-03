import 'mocha';
import { use, should, expect } from 'chai';
use(require("chai-as-promised"));
should();
import { CacheRedis } from '../src/CacheRedis';

function wait(ttl = 0): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ttl));
}

describe('Redis', () => {

	const cache = new CacheRedis('redis://localhost');

	before(done => {
		cache.connect().then(() => done());
	});

	after(done => {
		cache.disconnect().then(() => done()).catch(done);
	});

	it('get/set/has/unset', async () => {
		expect(await cache.has('a')).to.equal(false);
		await cache.set('a', 1);
		expect(await cache.has('a')).to.equal(true);
		expect(await cache.get('a')).to.equal('1');
		expect(await cache.has('b')).to.equal(false);
		expect(await cache.get('b')).to.equal(null);
		await cache.unset('a');
		expect(await cache.has('a')).to.equal(false);
	});

	it('increment', async () => {
		expect(await cache.has('c')).to.equal(false);
		await cache.increment('c');
		expect(await cache.has('c')).to.equal(true);
		expect(await cache.get('c')).to.equal('1');
		await cache.increment('c');
		expect(await cache.get('c')).to.equal('2');
		await cache.increment('c', 10);
		expect(await cache.get('c')).to.equal('12');
	});

	it('decrement', async () => {
		expect(await cache.has('d')).to.equal(false);
		await cache.set('d', '10');
		expect(await cache.has('d')).to.equal(true);
		expect(await cache.get('d')).to.equal('10');
		await cache.decrement('d');
		expect(await cache.get('d')).to.equal('9');
		await cache.decrement('d', 5);
		expect(await cache.get('d')).to.equal('4');
	});

	it('expire', async () => {
		await cache.set('e', 1, 1);
		expect(await cache.has('e')).to.equal(true);
		await wait(2000);
		expect(await cache.has('e')).to.equal(false);

		expect(await cache.has('f')).to.equal(false);
		await cache.set('f', 1);
		await cache.expire('f', 1);
		expect(await cache.has('f')).to.equal(true);
		await wait(2000);
		expect(await cache.has('f')).to.equal(false);

		expect(await cache.has('g')).to.equal(false);
		await cache.increment('g', 1, 1);
		expect(await cache.has('g')).to.equal(true);
		expect(await cache.get('g')).to.equal('1');
		await wait(2000);
		expect(await cache.has('g')).to.equal(false);
		expect(await cache.get('g')).to.equal(null);
	}).timeout(7000);

});