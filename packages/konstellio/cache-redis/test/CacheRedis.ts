import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();
import { CacheRedis } from '../src/CacheRedis';

describe('Redis', () => {

	const cache = new CacheRedis('redis://10.0.75.1');

	before(done => {
		cache.connect().then(() => done());
	});

	after(done => {
		cache.disconnect().then(() => done()).catch(done);
	});

	it('test', async () => {

		console.log(await cache.has('test'));
		await cache.set('test', 'Bleh', 600)
		console.log(await cache.has('test'));
		console.log(await cache.get('test'));
		await cache.unset('test')
		console.log(await cache.has('test'));
	})

})