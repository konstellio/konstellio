"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
process.on('unhandledRejection', () => { }); // and then Node deprecation warning goes away !
const EventEmitter_1 = require("./EventEmitter");
describe('EventEmitter', () => {
    it('has a constructor', () => {
        chai_1.expect(() => { new EventEmitter_1.EventEmitter(); }).to.not.throw(Error);
    });
    it('can check for IEventEmitter', () => {
        chai_1.expect(EventEmitter_1.isEventEmitterInterface(12)).to.equal(false);
        chai_1.expect(EventEmitter_1.isEventEmitterInterface(new EventEmitter_1.EventEmitter())).to.equal(true);
    });
    it('can add handler', () => {
        const event = new EventEmitter_1.EventEmitter();
        chai_1.expect(() => { event.on('t1', () => { }); }).to.not.throw(Error);
        chai_1.expect(() => { event.once('t1', () => { }); }).to.not.throw(Error);
        chai_1.expect(() => { event.many('t1', 1, () => { }); }).to.not.throw(Error);
        chai_1.expect(() => { event.dispose(); event.on('t1', () => { }); }).to.throw(Error);
    });
    it('can remove handler', () => {
        // const event = new EventEmitter();
    });
    it('can emit event', () => {
        const event = new EventEmitter_1.EventEmitter();
        let toDecrease = 12;
        event.on('t1', (d1, d2) => {
            toDecrease--;
            chai_1.expect(d1).to.equal('a');
            chai_1.expect(d2).to.equal('b');
        });
        event.on('t2', () => {
            toDecrease--;
        });
        event.once('t2', () => {
            toDecrease--;
        });
        event.many('t2', 3, () => {
            toDecrease--;
        });
        event.on('t3', () => {
            toDecrease--;
        });
        chai_1.expect(() => { event.emit('t1'); }).to.throw(chai_1.AssertionError);
        chai_1.expect(toDecrease).to.equal(11);
        chai_1.expect(() => { event.emit('t1', 'a', 'b'); }).to.not.throw(Error);
        chai_1.expect(toDecrease).to.equal(10);
        chai_1.expect(() => { event.emit('t2', 'c', 'd'); }).to.not.throw(Error);
        chai_1.expect(toDecrease).to.equal(7);
        chai_1.expect(() => { event.emit('t[23]', 'c', 'd'); }).to.not.throw(Error);
        chai_1.expect(toDecrease).to.equal(4);
        chai_1.expect(() => { event.emit('t2', 'c', 'd'); }).to.not.throw(Error);
        chai_1.expect(toDecrease).to.equal(2);
        chai_1.expect(() => { event.emit('t2', 'c', 'd'); }).to.not.throw(Error);
        chai_1.expect(toDecrease).to.equal(1);
        chai_1.expect(() => { event.dispose(); event.emit('t1', 'a', 'b'); }).to.throw(Error);
        chai_1.expect(toDecrease).to.equal(1);
    });
    const event = new EventEmitter_1.EventEmitter();
    let toDecrease = 12;
    event.on('t1', () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                toDecrease--;
                resolve(toDecrease);
            }, 100);
        });
    });
    event.on('t2', (d1, d2) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                toDecrease--;
                chai_1.expect(d1).to.equal('c');
                chai_1.expect(d2).to.equal('d');
                resolve(toDecrease);
            }, 100);
        });
    });
    it('can emitAsync event', () => {
        return Promise.all([
            event.emitAsync('t1').should.be.fulfilled.and.eventually.be.deep.equal([11]),
            event.emitAsync('t2', 'c', 'd').should.be.fulfilled.and.eventually.be.deep.equal([10]),
            new Promise(resolve => {
                event.dispose();
                resolve(event.emitAsync('t1'));
            }).should.be.rejectedWith(Error)
        ]);
    });
});
//# sourceMappingURL=EventEmitter.spec.js.map