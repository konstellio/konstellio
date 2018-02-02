import { ConfigFS } from './interfaces';
import { Driver, LocalDriver } from '@konstellio/fs';

export async function createFilesystem(config: ConfigFS, context?: any): Promise<Driver> {

	if (config.driver === 'local') {
		return new LocalDriver(config.root);
	}

	return Promise.reject(new ReferenceError(`Unsupported file system driver ${config.driver}.`));
}