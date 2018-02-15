import { ConfigFS, PluginContext } from './interfaces';
import { Driver, LocalDriver } from '@konstellio/fs';

export async function createFilesystem(config: ConfigFS): Promise<Driver> {

	if (config.driver === 'local') {
		return new LocalDriver(config.root);
	}

	return Promise.reject(new ReferenceError(`Unsupported file system driver ${config.driver}.`));
}