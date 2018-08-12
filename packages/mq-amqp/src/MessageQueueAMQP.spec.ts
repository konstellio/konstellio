import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();
import { MessageQueueAMQP } from './MessageQueueAMQP';
import { driverShouldBehaveLikeAMessageQueue } from '@konstellio/mq/dist/MessageQueue.spec';

describe('AMQP', () => {

	const mq = new MessageQueueAMQP('amqp://docker');
	before(done => {
		mq.connect().then(() => done()).catch(done)
	});

	driverShouldBehaveLikeAMessageQueue(mq);

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

});