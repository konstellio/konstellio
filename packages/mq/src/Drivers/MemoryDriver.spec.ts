import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { MemoryDriver } from './MemoryDriver';
import { driverShouldBehaveLikeAMessageQueue } from '../Driver.spec';

describe('Memory', () => {

	const mq: MemoryDriver = new MemoryDriver();
	before(done => {
		mq.connect().then(() => done()).catch(done)
	});

	driverShouldBehaveLikeAMessageQueue(mq);

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

});