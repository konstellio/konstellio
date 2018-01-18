import * as commander from 'commander';
import { isAbsolute, join, resolve, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createGraphQL, parseSchema, createDatabase, createFilesystem, createCache, createMessageQueue } from './';
import { SculptorConfig } from './lib/sculptorConfig';
import { createServer } from 'http';
import * as yaml from 'js-yaml';

commander
	.option('-f, --file [file]', 'Path to the sculptor file', join(process.cwd(), '.sculptor.yml'));

// commander
// 	.command('dev', 'Start server in development mode', { isDefault: true });

commander.parse(process.argv);


(async () => {
	const sculptorFile = isAbsolute(commander.file) ? commander.file : resolve(process.cwd(), commander.file);
	
	if (existsSync(sculptorFile) === false) {
		throw new Error(`Sculptor file ${sculptorFile} not found.`);
	}

	const config: SculptorConfig = yaml.safeLoad(readFileSync(sculptorFile));
	if (typeof config.version === 'undefined' || typeof config.sculptor === 'undefined') {
		throw new Error(`Sculptor file ${sculptorFile} is not a valid sculptor file.`);
	}

	const sculptorProject = dirname(sculptorFile);

	// Add sculptor project to package search path when requiring modules
	(require.main as any).paths.unshift(join(sculptorProject, 'node_modules'));

	const [db, fs, cache, mq] = await Promise.all([
		createDatabase(config.sculptor.database),
		createFilesystem(config.sculptor.fs),
		createCache(config.sculptor.cache),
		createMessageQueue(config.sculptor.mq)
	]);

	const graphql = await createGraphQL(
		config.sculptor.graphql,
		{
			db,
			fs,
			cache,
			mq
		}
	);

	// Create server
	const server = createServer(graphql);
	server.listen(
		config.sculptor.server && config.sculptor.server.port || 8080,
		config.sculptor.server && config.sculptor.server.host || 'localhost',
		() => {
			const addr = server.address();
			console.log(`Sculptor server is now running on http://${addr.address}:${addr.port}`);
		}
	)


})().catch(err => {
	console.error(err.stack);
	process.exit();
})
