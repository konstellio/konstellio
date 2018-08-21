"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
chai_1.use(require("chai-as-promised"));
chai_1.should();
const MessageQueueAMQP_1 = require("./MessageQueueAMQP");
const MessageQueue_spec_1 = require("@konstellio/mq/dist/MessageQueue.spec");
describe('AMQP', () => {
    const mq = new MessageQueueAMQP_1.MessageQueueAMQP('amqp://docker');
    before(done => {
        mq.connect().then(() => done()).catch(done);
    });
    MessageQueue_spec_1.driverShouldBehaveLikeAMessageQueue(mq);
    after(done => {
        mq.disconnect().then(() => done()).catch(done);
    });
});
//# sourceMappingURL=MessageQueueAMQP.spec.js.map