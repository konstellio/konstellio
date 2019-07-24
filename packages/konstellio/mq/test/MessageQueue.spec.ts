import 'mocha';
import { use, should, expect } from 'chai';
use(require('chai-as-promised'));
should();
import { MessageQueueMemory } from './MessageQueueMemory';

describe('MessageQueue', () => {
	it('subscribeIterator', async () => {
		const mq = new MessageQueueMemory();

		let i = 0;
		setInterval(() => {
			mq.publish('test', { counter: ++i });
		}, 500);

		const iter = mq.subscribeIterator<{ counter: number }>('test');

		const a = await iter.next();
		expect(a.value.counter).to.equal(1);
		expect(a.done).to.equal(false);

		const b = await iter.next();
		expect(b.value.counter).to.equal(2);
		expect(b.done).to.equal(false);

		const c = await iter.next();
		expect(c.value.counter).to.equal(3);
		expect(c.done).to.equal(false);
	});
});
