import { ConfigGraphql, PluginContext } from './interfaces';
import * as express from 'express';
import { Express } from '../../node_modules/@types/express-serve-static-core/index';
import * as bodyParser from 'body-parser';
import { graphqlExpress } from 'apollo-server-express';
import playgroundExpress from 'graphql-playground-middleware-express';
import { Kind, FieldDefinitionNode, DocumentNode } from 'graphql';
import { parse } from 'graphql/language/parser';
import { visit } from 'graphql/language/visitor';
import { GraphQLSchema } from 'graphql/type/schema';
import { makeExecutableSchema } from 'graphql-tools';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import { getArgumentsValues, parseSchema } from './parseSchema';
// import defaultPlugin from '../lib/defaultPlugin';

export interface Server {
	express: Express
	updateAST(ast: DocumentNode): void
	updateResolvers(resolvers: IResolvers): void
	clearCache(): void
}

export interface ServerOptions {
	ast?: DocumentNode
	resolvers?: IResolvers
}

export async function createGraphQL(
	config: ConfigGraphql
): Promise<Express> {
	const cache = new Map<string, GraphQLSchema>();

	// const basePlugin = await defaultPlugin();

	const app = express();
	app.disable('x-powered-by');

	// TODO authentification

	// app.use(
	// 	'/playground',
	// 	playgroundExpress({
	// 		endpoint: '/graphql'
	// 	})
	// );
	// app.use(
	// 	'/graphql',
	// 	bodyParser.urlencoded({ extended: true }),
	// 	bodyParser.json(),
	// 	graphqlExpress((req) => {

	// 		// TODO set groups from authentification
	// 		// TODO cache resulting schema for `groups`
	// 		// TODO Parse schema & resolvers from config
	// 		// TODO Schema from fs should be marked as "hardcoded"
	// 		// TODO Create DB helpers for each models in Schema

	// 		const groups = ['nobody'];

	// 		const ast = parse([basePlugin.graphql].join(`\n`), { noLocation: true });
	// 		const resolvers = [basePlugin.resolvers].reduce((resolvers, base) => {
	// 			Object.keys(base || {}).forEach(key => {
	// 				resolvers[key] = resolvers[key] || {};
	// 				Object.assign(resolvers[key], base[key]);
	// 			})
	// 			return resolvers;
	// 		});

	// 		// const models = parseSchema(ast);

	// 		const groupAst = visit(ast, {
	// 			[Kind.FIELD_DEFINITION](node: FieldDefinitionNode) {
	// 				const permission = node.directives && node.directives.find(directive => directive.name.value === 'permission');
	// 				if (permission) {
	// 					const args = permission.arguments ? getArgumentsValues(permission.arguments) : {};
	// 					if (args.group && groups.indexOf(args.group) === -1) {
	// 						return null; // returning null will delete this node
	// 					}
	// 				}
	// 			}
	// 		});

	// 		const schema = makeExecutableSchema({
	// 			typeDefs: groupAst,
	// 			resolvers,
	// 			resolverValidationOptions: {
	// 				allowResolversNotInSchema: true
	// 			}
	// 		});

	// 		// Object.assign(context, { req }, context);

	// 		return {
	// 			schema,
	// 			context
	// 		};
	// 	})
	// );

	return app;
}