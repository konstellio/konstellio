import { FastifyRequest } from 'fastify';

declare module 'fastify' {
	interface FastifyRequest<HttpRequest> {
		userId: string | null;
	}
}