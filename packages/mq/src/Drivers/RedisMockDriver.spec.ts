import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { RedisMockDriver } from './RedisMockDriver';

describe('RedisMock', function () {

	const mq: RedisMockDriver = new RedisMockDriver();

	before(done => {
		mq.connect().then(() => done());
	});

	after(done => {
		mq.disconnect().then(() => done()).catch(done);
	});

	it('test', async () => {

		const ch = await mq.createChannel('test1');
		ch.subscribe(msg => {
			console.log('S', msg.ts, msg.content.toString());
		});

		ch.publish(Buffer.from('New message from mocha'));


		const qu = await mq.createQueue('test2');
		qu.consume(msg => {
			console.log('C', msg.ts, msg.content.toString());
			return Buffer.from(msg.content);
		});

		qu.send(Buffer.from('New command from mocha'));

		await qu.sendRPC(Buffer.from('New rpc from mocha')).then((resp) => {
			console.log('R', resp.ts, resp.content.toString());
		});
	});

});