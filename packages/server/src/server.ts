import { createServer } from 'http';
// import { q, SQLiteDriver } from 'konstellio-db';
import { parseSchema } from './lib/parseSchema';
import { parse } from 'graphql/language/parser';
import { createGraphQLServer } from './lib/createGraphQLServer';

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

// TODO update ast and models when changes happens
const ast = parse(typeDefs, { noLocation: true });
const models = parseSchema(ast);

const app = createGraphQLServer({ ast, resolvers });
// app.updateAST(ast);
// app.updateResolvers(resolvers);

const server = createServer(app.express);
server.listen(8080, () => {
	console.log(`GraphQL server is now running on http://localhost:8080/.`);
});