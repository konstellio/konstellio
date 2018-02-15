import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createExpress, createGraphQL, createDatabase, createFilesystem, createCache, createMessageQueue, loadPlugin } from '../';
import { Config } from '../lib/interfaces';
import { createServer } from 'http';
import * as yaml from 'js-yaml';

export default async function ({ file }) {
	if (existsSync(file) === false) {
		console.error(`Configuration file ${file} not found.`);
		process.exit();
	}

	const config: Config = yaml.safeLoad(readFileSync(file));
	if (typeof config.version === 'undefined' || typeof config.sculptor === 'undefined') {
		console.error(`Configuration file ${file} is not a valid.`);
		process.exit();
	}
	const projectDir = dirname(file);

	const [db, fs, cache, mq] = await Promise.all([
		createDatabase(config.sculptor.database),
		createFilesystem(config.sculptor.fs),
		createCache(config.sculptor.cache),
		createMessageQueue(config.sculptor.mq)
	]);
	
	const app = await createExpress({});

	await loadPlugin(projectDir, config, app, { db, fs, cache, mq })

	// app.use(await createGraphQL(
	// 	config.sculptor.graphql,
	// 	{
	// 		db,
	// 		fs,
	// 		cache,
	// 		mq
	// 	}
	// ));

	// Create server
	const server = createServer(app);
	server.listen(
		config.sculptor.server && config.sculptor.server.port || 8080,
		config.sculptor.server && config.sculptor.server.host || 'localhost',
		() => {
			const addr = server.address();
			console.log(`Sculptor server is now running on http://${addr.address}:${addr.port}`);
		}
	)
}