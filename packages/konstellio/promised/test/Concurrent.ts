import 'mocha';
import { use, expect, should } from 'chai';
import { worker } from 'cluster';
use(require("chai-as-promised"));
should();

describe('Concurrent', () => {

	it('instanciate', async () => {
		// const d = new Deferred();
		// expect(d.resolve).to.be.a('function');
		// expect(d.reject).to.be.a('function');
		// expect(d.promise).to.be.an.instanceof(Promise);

		const counter = function*() {
			for (let i = 0; true; ++i) {
				yield i;
			}
		};

		const s = counter();

		const result = await concurrent(s, (i, w) => {
			console.log('cb', w, i);
		});
	});

	// it('defer', async () => {
	// 	const d = new Deferred<number>();
	// 	let t = 0;

	// 	setTimeout(() => d.resolve(10), 1000);

	// 	expect(t).to.eq(0);
	// 	d.then(v => t = v);
	// 	expect(t).to.eq(0);

	// 	await d.promise;

	// 	expect(t).to.eq(10);
	// });

});

async function* concurrent<T>(iterator: IterableIterator<T>, worker: (item: T, worker: number) => IterableIterator<void>, concurrency = 1) {
	const workers: IterableIterator<void>[] = [];

	for await (const item of iterator) {
		console.log('wait', item);
		while (workers.length === concurrency) {
			yield;
		}
		console.log('for', item);
		const id = workers.length + 1;
		workers.push(worker(item, id));
	}


}