import * as commander from 'commander';
import { isAbsolute, join, resolve } from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { parse } from 'graphql/language/parser';
import { createGraphQLServer, parseSchema } from './';
import baseResolvers from './baseResolvers';
import baseSchema from './baseSchema';
import { createServer } from 'http';

commander
	.option('-p, --project <project>', 'Path to the project folder', process.cwd());

commander
	.command('dev', 'Start server in development mode');

commander.parse(process.argv);

// Project location from cwd or --project argument
const projectLocation = isAbsolute(commander.project) ? commander.project : resolve(process.cwd(), commander.project);
const schemaLocation = join(projectLocation, 'schema.gql');
const resolversLocation = join(projectLocation, 'resolvers.js');

(async () => {
	const exists = promisify(fs.exists);
	const readFile = promisify(fs.readFile);

	// Check if project has all the files needed
	if (
		await exists(projectLocation) === false ||
		await exists(schemaLocation) === false ||
		await exists(resolversLocation) === false
	) {
		throw new Error(`Project "${projectLocation}" is not valid.`);
	}

	// TODO Fetch schema & resolvers from other source instead of files
	// Read schema & resolvers from project location
	const projectSchema = (await readFile(schemaLocation)).toString();
	const projectResolvers = await require(resolversLocation)();

	// Build final schema and resolvers (basically concating base and project)
	const finalSchema = await baseSchema() + `\n` + projectSchema;
	const finalResolvers = [await baseResolvers(), projectResolvers].reduce((final, part) => {
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
	server.listen(8080, 'localhost', () => {
		const addr = server.address();
		console.log(`Sculptor server is now running on http://${addr.address}:${addr.port}`);
	});

})().catch(err => {
	console.error(err);
	process.exit();
});