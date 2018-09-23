import { FastifyRequest, FastifyInstance } from 'fastify';
import { Server as WebsocketServer } from 'ws';

declare module 'fastify' {
	interface FastifyRequest<HttpRequest> {
		user?: string;
	}

	interface FastifyInstance {
		websocket?: WebsocketServer
	}
}