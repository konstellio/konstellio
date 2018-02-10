import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { AMQPDriver } from './AMQPDriver';
import { driverShouldBehaveLikeAMessageQueue } from '../Driver.spec';

describe('AMQP', () => {

	const mq: AMQPDriver = new AMQPDriver('amqp://10.0.75.1');
	before(done => {
		mq.connect().then(() => done()).catch(done)
	});

	driverShouldBehaveLikeAMessageQueue(mq);

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

});