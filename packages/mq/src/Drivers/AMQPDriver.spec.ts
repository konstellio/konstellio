import 'mocha';
import { use, should } from 'chai';
use(require("chai-as-promised"));
should();
import { AMQPDriver } from './AMQPDriver';
import { driverShouldBehaveLikeAMessageQueue } from '../Driver.spec';

describe('AMQP', () => {

	const mq: AMQPDriver = new AMQPDriver('amqp://docker');
	before(done => {
		mq.connect().then(() => done()).catch(done)
	});

	driverShouldBehaveLikeAMessageQueue(mq);

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

});