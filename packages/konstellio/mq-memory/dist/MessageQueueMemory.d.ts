import { Disposable } from '@konstellio/disposable';
import { MessageQueue, SubscribListener, ConsumeListener, Message, Payload } from '@konstellio/mq';
export declare class MessageQueueMemory extends MessageQueue {
    private emitter;
    private disposable;
    private consumers;
    private pendingTasks;
    constructor(retryPendingTaskEvery?: number);
    connect(): Promise<this>;
    disconnect(): Promise<void>;
    publish(name: string, payload: Payload): Promise<void>;
    publish(name: string, topic: string, payload: Payload): Promise<void>;
    subscribe(name: string, listener: SubscribListener): Promise<Disposable>;
    subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>;
    send(name: string, task: Payload): Promise<void>;
    rpc(name: string, task: Payload, timeout?: number): Promise<Message>;
    consume(name: string, listener: ConsumeListener): Promise<Disposable>;
}
