import { dirname } from 'path';
import { parseConfig } from '../utils/config';
import { Server, ServerStartMode } from '../server';

export default async function ({ file }) {
	const cwd = dirname(file);
	const config = await parseConfig(file);

	const server = await Server.create(config, cwd);

	const status = await server.start({ skipMigration: false, mode: ServerStartMode.Normal });

	console.log(`Server listening on http://${status.address}:${status.port}`);
}