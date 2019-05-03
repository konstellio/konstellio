import { FastifyRequest } from 'fastify';
import { AuthContext } from './auth';

declare module 'fastify' {
	interface FastifyRequest<HttpRequest> {
		context: AuthContext;
	}
}