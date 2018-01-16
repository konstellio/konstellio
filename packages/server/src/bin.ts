import * as commander from 'commander';
import { isAbsolute, join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'graphql/language/parser';
import { createGraphQLServer, parseSchema } from './';
import baseResolvers from './baseResolvers';
import baseSchema from './baseSchema';
import { createServer } from 'http';

// TODO Fetch schema & resolvers from database instead of files

commander
	.option('-p, --project <project>', 'Path to the project folder', process.cwd());

commander
	.command('dev', 'Start server in development mode');

commander.parse(process.argv);

// Project location from cwd or --project argument
const projectLocation = isAbsolute(commander.project) ? commander.project : resolve(process.cwd(), commander.project);
const schemaLocation = join(projectLocation, 'schema.gql');
const resolversLocation = join(projectLocation, 'resolvers.js');

// Check if project has all the files needed
if (
	existsSync(projectLocation) === false ||
	existsSync(schemaLocation) === false ||
	existsSync(resolversLocation) === false
) {
	console.error(`Project "${projectLocation}" is not valid.`);
	process.exit();
}

// Read schema from schemaLocation
let projectSchema;
try {
	projectSchema = readFileSync(schemaLocation).toString();
} catch (err) {
	console.error(`Could not load schema at ${schemaLocation}.`);
	process.exit();
}

// Read resolvers from resolversLocation
let projectResolvers;
try {
	projectResolvers = require(resolversLocation);
} catch (err) {
	console.error(`${err} at ${resolversLocation}.`);
	process.exit();
}

// Build final schema and resolvers (basically concating base and project)
const finalSchema = baseSchema + `\n` + projectSchema;
const finalResolvers = [baseResolvers, projectResolvers].reduce((final, part) => {
	const resolvers = part || {};
	Object.keys(resolvers).forEach(key => {
		final[key] = final[key] || {};
		Object.assign(final[key], resolvers[key]);
	});
	return final;
});

// Parse final schema to an AST
const ast = parse(finalSchema, { noLocation: true });

// const models = parseSchema(ast);

// Create graphql express app
const app = createGraphQLServer({
	ast,
	resolvers: finalResolvers
});

// Create server
const server = createServer(app.express);
server.listen(8080, () => {
	const addr = server.address();
	console.log(`Sculptor server is now running on http://${addr.address}:${addr.port}`);
})