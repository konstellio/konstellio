import { Disposable } from '../../disposable/dist/Disposable';
import { MessageQueue, SubscribListener, ConsumeListener, Message, Payload } from '@konstellio/mq';
export declare class MessageQueueAMQP extends MessageQueue {
    protected url: string;
    protected socketOptions?: any;
    private client;
    private emitter;
    private disposable;
    private replyToChannel;
    private replyToQueue;
    private channels;
    private queues;
    constructor(url: string, socketOptions?: any);
    connect(): Promise<this>;
    disconnect(): Promise<void>;
    private getChannel;
    private getQueue;
    publish(name: string, payload: Payload): Promise<void>;
    publish(name: string, topic: string, payload: Payload): Promise<void>;
    subscribe(name: string, listener: SubscribListener): Promise<Disposable>;
    subscribe(name: string, topic: string, listener: SubscribListener): Promise<Disposable>;
    send(name: string, task: Payload): Promise<void>;
    rpc(name: string, task: Payload, timeout?: number): Promise<Message>;
    consume(name: string, listener: ConsumeListener): Promise<Disposable>;
}
