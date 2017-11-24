import { createServer } from 'http';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { q, SQLiteDriver } from 'konstellio-db';
import { buildSchema } from 'konstellio-schema';
import { parse } from 'graphql/language/parser';
import { Kind, FieldDefinitionNode } from 'graphql';
import { StringValueNode } from '../../schema/node_modules/@types/graphql';
import { visit } from 'graphql/language/visitor';
import { makeExecutableSchema } from 'graphql-tools';

// TODO should get schema from DB (both definition & resolvers code)
import schemas from './schemas';
const typeDefs = schemas.reduce((acc, schema) => {
	return acc + `\n` + schema.typeDefs;
}, '');
const resolvers = schemas.reduce((acc, schema) => {
	const resolvers = schema.resolvers || {};
	Object.keys(resolvers).forEach(key => {
		acc[key] = acc[key] || {};
		Object.assign(acc[key], resolvers[key]);
	});
	return acc;
}, {});


const ast = parse(typeDefs);
const models = buildSchema(ast);



const app = express();
app.disable('x-powered-by');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));
app.use('/graphql', graphqlExpress((req) => {

	const groups = ['nobody']

	const groupAst = visit(ast, {
		[Kind.FIELD_DEFINITION](node: FieldDefinitionNode) {
			const permission = node.directives && node.directives.find(directive => directive.name.value === 'permission');
			if (permission) {
				const argGroup = permission.arguments && permission.arguments.find(arg => arg.name.value === 'group');
				if (argGroup) {
					const value = (argGroup.value as StringValueNode).value;
					if (groups.indexOf(value) === -1) {
						return null; // returning null will delete this node
					}
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

const server = createServer(app);
server.listen(8080, () => {
	console.log(`GraphQL server is now running on http://localhost:8080/.`);
});