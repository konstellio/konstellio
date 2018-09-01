import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { MessageQueueMemory } from '../src/MessageQueueMemory';
import { Disposable } from '@konstellio/disposable';

function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Memory', () => {

	const mq = new MessageQueueMemory();
	before(done => {
		mq.connect().then(() => done()).catch(done);
	});

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

	it('can publish to channel', async () => {
		await mq.publish('foo1', { foo: 'bar' }).should.be.fulfilled;
	});

	it('can subscribe to channel', async () => {
		let count = 0;

		const subscriber1 = await mq.subscribe('foo2', (msg) => {
			count += msg.add as number;
		});
		expect(subscriber1).to.be.an.instanceOf(Disposable);

		await mq.publish('foo2', { add: 1 });
		await wait(500);
		expect(count).to.equal(1);

		const subscriber2 = await mq.subscribe('foo2', (msg) => {
			count += msg.add as number;
		});
		expect(subscriber2).to.be.an.instanceOf(Disposable);

		await mq.publish('foo2', { add: 2 });
		await wait(500);
		expect(count).to.equal(5);
	});

	it('can unsubscribe', async () => {
		let count = 0;

		const subscriber1 = await mq.subscribe('foo3', (msg) => {
			count += msg.add as number;
		});
		expect(subscriber1).to.be.an.instanceOf(Disposable);

		await mq.publish('foo3', { add: 1 });
		await wait(500);
		expect(count).to.equal(1);

		subscriber1.dispose();

		await mq.publish('foo3', { add: 2 });
		await wait(500);
		expect(count).to.equal(1);
	});

	it('can send task', async () => {
		await mq.send('bar1', { bar: 'foo' }).should.be.fulfilled;
	});

	it('can consume task', async () => {
		let count = 0;

		const consumer = await mq.consume('bar2', () => {
			++count;
		});
		expect(consumer).to.be.an.instanceOf(Disposable);

		await mq.send('bar2', {  });
		await wait(500);
		expect(count).to.equal(1);
	});

	it('can stop consuming task', async () => {
		let count = 0;

		const consumer = await mq.consume('bar3', () => {
			++count;
		});
		expect(consumer).to.be.an.instanceOf(Disposable);

		await mq.send('bar3', {  });
		await wait(500);
		expect(count).to.equal(1);

		consumer.dispose();
		await mq.send('bar3', {  });
		await wait(500);
		expect(count).to.equal(1);
	});

	it('can get result from rpc', async () => {
		const consumer = await mq.consume('bar4', (msg) => {
			return { ts: Date.now(), bar: msg.bar };
		});
		expect(consumer).to.be.an.instanceOf(Disposable);

		const result = await mq.rpc('bar4', { bar: 'Hello World' }, 2000).should.be.fulfilled;
		expect(result.bar).to.equal('Hello World');
	});

	it('can get error from rpc', async () => {
		const consumer = await mq.consume('bar5', () => {
			throw new Error('Fake error');
		});
		expect(consumer).to.be.an.instanceOf(Disposable);

		try {
			await mq.rpc('bar5', { bar: 'Hello World' }, 2000).should.be.rejected;
		} catch (err) {
			expect(err.message).to.equal('Fake error');
		}
	});

	it('can consume pending task', async () => {
		let count = 0;

		await mq.send('bar6', {  });
		await wait(500);
		expect(count).to.equal(0);

		const consumer = await mq.consume('bar6', () => {
			++count;
		});
		expect(consumer).to.be.an.instanceOf(Disposable);
		await wait(2000);
		expect(count).to.equal(1);
	}).timeout(3000);

});