import {
	GraphQLOptions,
	FileUploadOptions,
	ApolloServerBase,
	formatApolloErrors,
	runHttpQuery
} from 'apollo-server-core';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import * as corsMiddleware from 'fastify-cors';
import { IncomingMessage, ServerResponse } from 'http';
import { Headers } from 'apollo-server-env';

export const registerServer = () => {
	throw new Error(`Please use server.applyMiddleware instead of registerServer. This warning will be removed in the next release`);
};

export type Request = FastifyRequest<IncomingMessage>;
export type Response = FastifyReply<ServerResponse>;

export interface ServerRegistration {
	app: FastifyInstance;
	path?: string;
	cors?: corsMiddleware.FastifyCorsOptions | true;
	disableHealthCheck?: boolean;
	onHealthCheck?: (req: Request) => Promise<any>;
}

export class ApolloServer extends ApolloServerBase {
	protected supportsSubscriptions(): boolean {
		return true;
	}

	protected supportsUploads(): boolean {
		return true;
	}

	async createGraphQLServerOptions(
		req: Request,
		res: Response
	): Promise<GraphQLOptions> {
		return super.graphQLServerOptions({ req, res });
	}

	public applyMiddleware({
		app,
		path,
		cors,
		disableHealthCheck,
		onHealthCheck
	}: ServerRegistration) {
		path = path || '/graphql';

		if (!disableHealthCheck) {
			const healthCheckSchema = {
				body: {
					type: 'object',
					properties: {
						status: { type: 'string' }
					}
				}
			};
			
			// uses same path as engine proxy, but is generally useful.
			app.get('/.well-known/apollo/server-health', { schema: healthCheckSchema }, (req, res) => {
				// Response follows https://tools.ietf.org/html/draft-inadarei-api-health-check-01
				res.type('application/health+json');
				
				if (onHealthCheck) {
					onHealthCheck(req)
						.then(() => res.send({ status: 'pass' }))
						.catch(() => res.status(503).send({ status: 'pass' }));
				} else {
					res.send({ status: 'pass' });
				}
			});
		}

		if (cors === true) {
			app.register(corsMiddleware, { });
		}
		else if (cors) {
			app.register(corsMiddleware, { cors });
		}

		if (this.uploadsConfig) {
			// TODO : Apollo Upload Server
			// Fastify upload https://github.com/fastify/fastify-multipart
			// Process upload https://github.com/apollographql/apollo-server/blob/master/packages/apollo-server-express/src/ApolloServer.ts#L38
			// Dep @apollographql/apollo-upload-server
		}

		app.route({
			url: path,
			method: ['GET', 'POST', 'OPTIONS'],
			handler: async (req, res) => {
				// TODO: Build schema for this request & cache it
				try {
					// https://github.com/nfishe/fastify-apollo/blob/master/graphql.js
					const result = await runHttpQuery([req, res], {
						method: 'POST',
						options: await this.createGraphQLServerOptions(req, res),
						query: req.body || req.query,
						request: {
							url: req.req.url!,
							method: req.req.method!,
							headers: new Headers()
						}
					});
					// res.header('Content-Length', Buffer.byteLength(result, 'utf8').toString()); // FIXME: Required ?
					res.send(JSON.parse(result.graphqlResponse));
				} catch (error) {
					if (error.name === 'HttpQueryError') {
						for (const key in error.headers) {
							res.header(key, error.headers[key]);
						}
						// res.code(error.statusCode); // FIXME: Required ?
						res.send(JSON.parse(error.message));
					}
				}
			}
		});
	}
}