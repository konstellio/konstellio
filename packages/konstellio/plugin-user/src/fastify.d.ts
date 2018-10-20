import { FastifyRequest } from 'fastify';

declare module 'fastify' {
	interface FastifyRequest<HttpRequest> {
		userId?: string;
		userGroups?: string[];
		userRoles?: string[];
	}
}