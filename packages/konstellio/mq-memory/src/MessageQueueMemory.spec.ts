import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();
import { MessageQueueMemory } from './MessageQueueMemory';
import { driverShouldBehaveLikeAMessageQueue } from '@konstellio/mq/dist/MessageQueue.spec';

describe('Memory', () => {

	const mq = new MessageQueueMemory();
	before(done => {
		mq.connect().then(() => done()).catch(done)
	});

	driverShouldBehaveLikeAMessageQueue(mq);

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

});