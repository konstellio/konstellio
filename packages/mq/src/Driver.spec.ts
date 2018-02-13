import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();
import { Driver, Channel, Queue, Message } from './Driver';
import { Disposable } from '@konstellio/disposable';

function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function driverShouldBehaveLikeAMessageQueue(driver: Driver) {

	describe('Channel', function () {
		this.timeout(10000);

		it('createChannel', async () => {
			const channel = await driver.createChannel('foo1').should.be.fulfilled;
			expect(channel).to.be.an.instanceOf(Channel);
		});

		it('publish to channel', async () => {
			const channel = await driver.createChannel('foo2');
			expect(channel.publish).to.be.a('function');
			expect(() => channel.publish(Buffer.from('bar'))).to.not.throw;
		})

		it('subscribe to channel', async () => {
			const channel = await driver.createChannel('foo3');
			expect(channel.subscribe).to.be.a('function');

			let count = 0;
			const subscriber1 = channel.subscribe(msg => {
				++count;
			});

			expect(subscriber1).to.be.an.instanceOf(Disposable);
			expect(subscriber1.isDisposed()).to.be.equal(false);
			expect(count).to.be.equal(0);

			channel.publish(Buffer.from('bar'));
			await wait(500);
			expect(count).to.be.equal(1);

			const subscriber2 = channel.subscribe(msg => {
				++count;
			});
			expect(subscriber2).to.be.an.instanceOf(Disposable);
			expect(subscriber2.isDisposed()).to.be.equal(false);
			expect(count).to.be.equal(1);

			channel.publish(Buffer.from('bar'));
			await wait(500);
			expect(count).to.be.equal(3);
		});

		it('unsubscribe of channel', async () => {
			const channel = await driver.createChannel('foo4');
			expect(channel.subscribe).to.be.a('function');

			let count = 0;
			const subscriber1 = channel.subscribe(msg => {
				++count;
			});

			expect(subscriber1).to.be.an.instanceOf(Disposable);
			expect(subscriber1.isDisposed()).to.be.equal(false);
			expect(subscriber1.dispose).to.be.a('function');
			expect(count).to.be.equal(0);

			channel.publish(Buffer.from('bar'));
			await wait(500);
			expect(count).to.be.equal(1);

			subscriber1.dispose();

			channel.publish(Buffer.from('bar'));
			await wait(500);
			expect(count).to.be.equal(1);
		});

	});

	describe('Queue', function () {
		this.timeout(10000);

		it('createQueue', async () => {
			const queue = await driver.createQueue('bar1').should.be.fulfilled;
			expect(queue).to.be.an.instanceOf(Queue);
		});

		it('send to queue', async () => {
			const queue = await driver.createQueue('bar2');
			expect(queue.send).to.be.a('function');
			expect(() => queue.send(Buffer.from('bar'))).to.not.throw;
		});

		it('consume queue', async () => {
			const queue = await driver.createQueue('bar3');
			expect(queue.consume).to.be.a('function');
			
			let count = 0;
			const cosumer1 = queue.consume(msg => {
				++count;
			});

			queue.send(Buffer.from('bar'));
			await wait(500);
			expect(count).to.be.equal(1);
		});

		it('sendRPC to queue', async () => {
			const queue = await driver.createQueue('bar4');
			expect(queue.sendRPC).to.be.a('function');
			expect(() => queue.sendRPC(Buffer.from('bar'))).to.not.throw;
		});

		it('respond to queue', async () => {
			const queue = await driver.createQueue('bar5');
			expect(queue.consume).to.be.a('function');

			let count = 0;
			const cosumer1 = queue.consume((msg) => {
				++count;
				return Buffer.from((count * 10).toString());
			});

			const response1: Message = await queue.sendRPC(Buffer.from('bar')).should.be.fulfilled;
			expect(response1.content).to.exist;
			expect(response1.content.toString()).to.be.equal('10');
		});

		it('respond to queue with error', async () => {
			const queue = await driver.createQueue('bar6');
			expect(queue.consume).to.be.a('function');

			let count = 0;
			const cosumer1 = queue.consume((msg) => {
				throw new Error('Oupsy');
			});

			try {
				const response1: Message = await queue.sendRPC(Buffer.from('bar')).should.be.rejected;
			} catch (err) {
				expect(err.message).to.be.equal('Oupsy');
			}
		});
	});

}