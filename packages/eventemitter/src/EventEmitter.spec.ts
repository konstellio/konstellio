import 'mocha';
import { expect, use, should, AssertionError } from 'chai';
use(require("chai-as-promised"));
should();
process.on('unhandledRejection', (reason: Error | null, promise: Promise<void>) => { }); // and then Node deprecation warning goes away !

import { EventEmitter, isEventEmitterInterface } from './EventEmitter';

describe('EventEmitter', () => {

	it('has a constructor', () => {
		expect(() => { new EventEmitter(); }).to.not.throw(Error);
	});

	it('can check for IEventEmitter', () => {
		expect(isEventEmitterInterface(12)).to.equal(false);
		expect(isEventEmitterInterface(new EventEmitter())).to.equal(true);
	});

	it('can add handler', () => {
		const event = new EventEmitter();

		expect(() => { event.on('t1', () => {  }); }).to.not.throw(Error);
		expect(() => { event.once('t1', () => {  }); }).to.not.throw(Error);
		expect(() => { event.many('t1', 1, () => {  }); }).to.not.throw(Error);
		expect(() => { event.dispose(); event.on('t1', () => {  }); }).to.throw(Error);
	});

	it('can remove handler', () => {
		const event = new EventEmitter();
	});

	it('can emit event', () => {

		const event = new EventEmitter();
		let toDecrease = 12;
		
		event.on('t1', (d1, d2) => {
			toDecrease--;
			expect(d1).to.equal('a');
			expect(d2).to.equal('b');
		});
		event.on('t2', (d1, d2) => {
			toDecrease--;
		});
		event.once('t2', (d1, d2) => {
			toDecrease--;
		});
		event.many('t2', 3, (d1, d2) => {
			toDecrease--;
		});
		event.on('t3', (d1, d2) => {
			toDecrease--;
		});

		expect(() => { event.emit('t1'); }).to.throw(AssertionError);
		expect(toDecrease).to.equal(11);
		expect(() => { event.emit('t1', 'a', 'b'); }).to.not.throw(Error);
		expect(toDecrease).to.equal(10);
		expect(() => { event.emit('t2', 'c', 'd'); }).to.not.throw(Error);
		expect(toDecrease).to.equal(7);
		expect(() => { event.emit('t[23]', 'c', 'd'); }).to.not.throw(Error);
		expect(toDecrease).to.equal(4);
		expect(() => { event.emit('t2', 'c', 'd'); }).to.not.throw(Error);
		expect(toDecrease).to.equal(2);
		expect(() => { event.emit('t2', 'c', 'd'); }).to.not.throw(Error);
		expect(toDecrease).to.equal(1);

		expect(() => { event.dispose(); event.emit('t1', 'a', 'b'); }).to.throw(Error);
		expect(toDecrease).to.equal(1);
	});

	const event = new EventEmitter();
	let toDecrease = 12;

	event.on('t1', (d1, d2) => {
		return new Promise((resolve) => {
			setTimeout(() => {
				toDecrease--;
				resolve(toDecrease);
			}, 100);
		})
	});
	event.on('t2', (d1, d2) => {
		return new Promise((resolve) => {
			setTimeout(() => {
				toDecrease--;
				expect(d1).to.equal('c');
				expect(d2).to.equal('d');
				resolve(toDecrease);
			}, 100);
		})
	});

	it('can emitAsync event', () => {
		return Promise.all([
			(<any>event.emitAsync('t1')).should.be.fulfilled.and.eventually.be.deep.equal([11]),
			(<any>event.emitAsync('t2', 'c', 'd')).should.be.fulfilled.and.eventually.be.deep.equal([10]),
			(<any>new Promise(resolve => {
				event.dispose();
				resolve(event.emitAsync('t1'));
			})).should.be.rejectedWith(Error)
		]);
	});


});