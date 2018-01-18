import { SculptorFS } from './sculptorConfig';
import { promisify } from 'util';
import { createReadStream, createWriteStream, stat, unlink, exists } from 'fs';

export async function createFilesystem(config: SculptorFS, context?: any): Promise<any> {
	return {
		createReadStream,
		createWriteStream,
		stat: promisify(stat),
		unlink: promisify(unlink),
		exists: promisify(exists)
	};
}