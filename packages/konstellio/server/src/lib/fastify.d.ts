import { FastifyRequest } from 'fastify';

declare module 'fastify' {
	interface FastifyRequest<HttpRequest> {
		user?: string;
	}
}