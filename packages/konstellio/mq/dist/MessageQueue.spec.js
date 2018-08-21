"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const disposable_1 = require("@konstellio/disposable");
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function driverShouldBehaveLikeAMessageQueue(mq) {
    describe('Base driver', function () {
        this.timeout(10000);
        it('can publish to channel', () => __awaiter(this, void 0, void 0, function* () {
            yield mq.publish('foo1', { foo: 'bar' }).should.be.fulfilled;
        }));
        it('can subscribe to channel', () => __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            const subscriber1 = yield mq.subscribe('foo2', (msg) => {
                count += msg.add;
            });
            chai_1.expect(subscriber1).to.be.an.instanceOf(disposable_1.Disposable);
            yield mq.publish('foo2', { add: 1 });
            yield wait(500);
            chai_1.expect(count).to.equal(1);
            const subscriber2 = yield mq.subscribe('foo2', (msg) => {
                count += msg.add;
            });
            chai_1.expect(subscriber2).to.be.an.instanceOf(disposable_1.Disposable);
            yield mq.publish('foo2', { add: 2 });
            yield wait(500);
            chai_1.expect(count).to.equal(5);
        }));
        it('can unsubscribe', () => __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            const subscriber1 = yield mq.subscribe('foo3', (msg) => {
                count += msg.add;
            });
            chai_1.expect(subscriber1).to.be.an.instanceOf(disposable_1.Disposable);
            yield mq.publish('foo3', { add: 1 });
            yield wait(500);
            chai_1.expect(count).to.equal(1);
            subscriber1.dispose();
            yield mq.publish('foo3', { add: 2 });
            yield wait(500);
            chai_1.expect(count).to.equal(1);
        }));
        it('can send task', () => __awaiter(this, void 0, void 0, function* () {
            yield mq.send('bar1', { bar: 'foo' }).should.be.fulfilled;
        }));
        it('can consume task', () => __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            const consumer = yield mq.consume('bar2', () => {
                ++count;
            });
            chai_1.expect(consumer).to.be.an.instanceOf(disposable_1.Disposable);
            yield mq.send('bar2', {});
            yield wait(500);
            chai_1.expect(count).to.equal(1);
        }));
        it('can stop consuming task', () => __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            const consumer = yield mq.consume('bar3', () => {
                ++count;
            });
            chai_1.expect(consumer).to.be.an.instanceOf(disposable_1.Disposable);
            yield mq.send('bar3', {});
            yield wait(500);
            chai_1.expect(count).to.equal(1);
            consumer.dispose();
            yield mq.send('bar3', {});
            yield wait(500);
            chai_1.expect(count).to.equal(1);
        }));
        it('can get result from rpc', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = yield mq.consume('bar4', (msg) => {
                return { ts: Date.now(), bar: msg.bar };
            });
            chai_1.expect(consumer).to.be.an.instanceOf(disposable_1.Disposable);
            const result = yield mq.rpc('bar4', { bar: 'Hello World' }, 2000).should.be.fulfilled;
            chai_1.expect(result.bar).to.equal('Hello World');
        }));
        it('can get error from rpc', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = yield mq.consume('bar5', () => {
                throw new Error('Fake error');
            });
            chai_1.expect(consumer).to.be.an.instanceOf(disposable_1.Disposable);
            try {
                yield mq.rpc('bar5', { bar: 'Hello World' }, 2000).should.be.rejected;
            }
            catch (err) {
                chai_1.expect(err.message).to.equal('Fake error');
            }
        }));
        it('can consume pending task', () => __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            yield mq.send('bar6', {});
            yield wait(500);
            chai_1.expect(count).to.equal(0);
            const consumer = yield mq.consume('bar6', () => {
                ++count;
            });
            chai_1.expect(consumer).to.be.an.instanceOf(disposable_1.Disposable);
            yield wait(2000);
            chai_1.expect(count).to.equal(1);
        }));
    });
}
exports.driverShouldBehaveLikeAMessageQueue = driverShouldBehaveLikeAMessageQueue;
//# sourceMappingURL=MessageQueue.spec.js.map