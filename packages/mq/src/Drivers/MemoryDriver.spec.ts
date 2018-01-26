import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { spawn, ChildProcess } from 'child_process';
import { MemoryDriver } from './MemoryDriver';

describe('RedisMock', () => {

	const driver: MemoryDriver = new MemoryDriver();

	before(done => {
		driver.connect().then(() => done());
	});
	
	it('test', async () => {
		
		const q = await driver.createQueue('test');

		q.subscribe(msg => {
			console.log('New message', msg.ts, msg.sender, msg.content);
		});

		setInterval(() => {
			q.publish(Buffer.from('Yay'));
		}, 200);

	})

})