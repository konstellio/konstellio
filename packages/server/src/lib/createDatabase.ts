import { Driver, SQLiteDriver, } from '@konstellio/db';
import { ConfigDB, PluginContext } from './interfaces';

export async function createDatabase(config: ConfigDB): Promise<any> {

	let driver: Driver;
	switch (config.driver) {
		case 'sqlite':
			driver = await new SQLiteDriver(
				config.filename === 'mock://memory'
					? Object.assign({}, config, { filename: ':memory:' })
					: config
			);
			break;
		default:
			throw new ReferenceError(`Unsupported database driver ${config.driver}.`);
	}

	return await driver.connect();
}