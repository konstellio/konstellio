import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { MemoryDriver } from './MemoryDriver';
import { setTimeout } from 'timers';

describe('RedisMock', () => {

	const mq: MemoryDriver = new MemoryDriver();

	before(done => {
		mq.connect().then(() => done());
	});
	
	it('test', async () => {
		
		const ch = await mq.createChannel('test1');
		ch.subscribe(msg => {
			console.log('Subscribe', msg.ts, msg.sender, msg.content.toString());
		});
		// setInterval(() => {
		// 	ch.publish(Buffer.from('Yay'));
		// }, 200);

		const qu = await mq.createQueue('test2');
		qu.consume(async (msg) => {
			await new Promise(resolve => setTimeout(resolve, 2000));
			console.log('Consume', msg.ts, msg.sender, msg.content.toString());
			return msg.content;
		});
		qu.send(Buffer.from('Yay1'))
		qu.await(Buffer.from('Yay2')).then(msg => {
			console.log('Done', msg.ts, msg.sender, msg.content.toString());
		});

	})

})