import * as express from 'express';
import { Express } from '../../node_modules/@types/express-serve-static-core/index';
import * as bodyParser from 'body-parser';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { visit } from 'graphql/language/visitor';
import { makeExecutableSchema } from 'graphql-tools';
import { Kind, FieldDefinitionNode } from 'graphql';
import { DocumentNode } from 'graphql';
import { getArgumentsValues } from './parseSchema';
import { IResolvers } from 'graphql-tools/dist/Interfaces';
import { GraphQLSchema } from 'graphql/type/schema';

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

export function createGraphQLServer({ ast, resolvers }: ServerOptions): Server {
	const cache = new Map<string, GraphQLSchema>();

	const app = express();
	app.disable('x-powered-by');
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(bodyParser.json());
	app.use('/graphiql', graphiqlExpress({
		endpointURL: '/graphql'
	}));
	app.use('/graphql', graphqlExpress((req) => {

		const groups = ['nobody']

		// TODO cache resulting schema for `groups`
		const groupAst = visit(ast, {
			[Kind.FIELD_DEFINITION](node: FieldDefinitionNode) {
				const permission = node.directives && node.directives.find(directive => directive.name.value === 'permission');
				if (permission) {
					const args = permission.arguments ? getArgumentsValues(permission.arguments) : {};
					if (args.group && groups.indexOf(args.group) === -1) {
						return null; // returning null will delete this node
					}
				}
			}
		});

		const schema = makeExecutableSchema({
			typeDefs: groupAst,
			resolvers,
			resolverValidationOptions: {
				allowResolversNotInSchema: true
			}
		});

		return {
			schema
		};
	}));

	return {
		express: app,
		updateAST(newAST: DocumentNode): void {
			cache.clear();
			ast = newAST;
		},
		updateResolvers(newResolvers: IResolvers): void {
			cache.clear();
			resolvers = newResolvers;
		},
		clearCache(): void {
			cache.clear();
		}
	}
}