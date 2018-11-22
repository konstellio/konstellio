import { safeLoad } from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as resolve from 'resolve';
import { isArray, promisify } from 'util';
import * as Joi from 'joi';

const readFile = promisify(fs.readFile);
const fileExists = promisify(fs.exists);
const resolveModule = (id: string, dir: string) => new Promise<string>((res, rej) => {
	resolve(id, { basedir: dir }, (err, path) => {
		if (err) {
			return rej(err);
		}
		res(path);
	});
});

const defaultService: Service = {
	root: '',
	version: '1',
	schema: [],
	database: {
		type: '@konstellio/db-sqlite',
		location: './database.sqlite'
	},
	filesystem: {
		type: '@konstellio/fs-local',
		location: './public'
	},
	cache: {
		type: '@konstellio/cache-memory',
	},
	messagequeue: {
		type: '@konstellio/mq-memory',
	},
	import: [],
	generate: {
		generator: 'typescript',
		destination: './generated/konstellio'
	}
};

const serviceSchema = Joi.object().keys({
	version: Joi.string().regex(/[0-9\.]+/).required(),
	locales: Joi.object().pattern(/[a-z]{2}(_[A-Z]{2})?/, Joi.string().required()).optional(),
	schema: Joi.alternatives([
		Joi.string().required(),
		Joi.array().items(Joi.string().required()).min(1)
	]).optional(),
	endpoint: Joi.string().optional(),
	database: Joi.object().keys(undefined).append({
		type: Joi.string().required()
	}).requiredKeys(['type']).optional(),
	filesystem: Joi.object().keys(undefined).append({
		type: Joi.string().required()
	}).requiredKeys(['type']).optional(),
	cache: Joi.object().keys(undefined).append({
		type: Joi.string().required()
	}).requiredKeys(['type']).optional(),
	messagequeue: Joi.object().keys(undefined).append({
		type: Joi.string().required()
	}).requiredKeys(['type']).optional(),
	import: Joi.alternatives([
		Joi.string().required(),
		Joi.array().items(Joi.string().required()).min(1)
	]).optional(),
	generate: Joi.object().keys({
		generator: Joi.string().required(),
		destination: Joi.string().required()
	}).optional()
});

export interface Service {
	root: string;
	version: string;
	locales?: { [code: string]: string };
	schema: string[];
	database: {
		type: string;
		[param: string]: any
	};
	filesystem: {
		type: string;
		[param: string]: any
	};
	cache: {
		type: string;
		[param: string]: any
	};
	messagequeue: {
		type: string;
		[param: string]: any
	};
	import: Service[];
	generate: {
		generator: string;
		destination: string;
	};
}

export async function parseServiceFromFile(file: string, dir: string): Promise<Service> {
	const data = await readFile(file, { encoding: 'utf8' });
	return parseService(data, dir);
}

// export async function parseServiceFromPackage(location: string): Promise<Service> {
// 	const service = Object.assign({}, defaultService);
// 	service.root = path.dirname(location);

// 	return service;
// }

export async function parseService(data: string, dir: string): Promise<Service> {
	const yaml = safeLoad(data, {  });
	const service = await serviceSchema.validate<any>(yaml);
	service.root = dir;

	const imports: string[] = service.import
		? (isArray(service.import) ? service.import : [service.import])
		: [];
	
	service.import = [];
	for (const file of imports) {
		try {
			const potentialFile = path.resolve(file);
			if (await fileExists(potentialFile)) {
				debugger;
			}
			else {
				const potentialModule = await resolveModule(file, dir);
				debugger;
				// parseConfigurationFromPackage(potentialModule);
			}
		} catch (err) {
			throw new Error(`Could not find service at "${file}".`);
		}
	}

	service.schema = service.schema
		? isArray(service.schema) ? service.schema : [service.schema]
		: [];

	return Object.assign({}, defaultService, service);
}