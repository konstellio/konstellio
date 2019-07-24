import * as Joi from 'joi';
import { readFile } from 'fs';
import { safeLoadAll } from 'js-yaml';

export interface Configuration {
	secret: string;

	locales?: {
		[code: string]: string;
	};

	generate: {
		language: 'typescript';
		destination: string;
	};

	extensions?: string[];

	database: {
		driver: string;
		[key: string]: any;
	};

	filesystem: {
		driver: string;
		[key: string]: any;
	};

	cache: {
		driver: string;
		[key: string]: any;
	};

	mq: {
		driver: string;
		[key: string]: any;
	};
}

const configurationValidator = Joi.object().keys({
	secret: Joi.string().required(),
	locales: Joi.object()
		.pattern(/[a-z]{2}/, Joi.string().required())
		.min(1),
	generate: Joi.object()
		.keys({
			language: Joi.string()
				.allow('typescript')
				.required(),
			destination: Joi.string().required(),
		})
		.default({
			language: 'typescript',
			destination: './src/generated/konstellio',
		}),
	extensions: Joi.array()
		.items(Joi.string())
		.min(1),
	database: Joi.object({
		driver: Joi.string().required(),
	})
		.pattern(/.*/, Joi.any())
		.default({
			driver: '@konstellio/db-sqlite',
			filename: './db.sqlite',
		}),
	filesystem: Joi.object({
		driver: Joi.string().required(),
	})
		.pattern(/.*/, Joi.any())
		.default({
			driver: '@konstellio/fs-local',
			rootDirectory: './storage',
		}),
	cache: Joi.object({
		driver: Joi.string().required(),
	})
		.pattern(/.*/, Joi.any())
		.default({
			driver: '@konstellio/cache-memory',
		}),
	mq: Joi.object({
		driver: Joi.string().required(),
	})
		.pattern(/.*/, Joi.any())
		.default({
			driver: '@konstellio/mq-memory',
		}),
});

export function validateConfiguration(conf: any) {
	return Joi.validate<any>(conf, configurationValidator) as Joi.ValidationResult<Configuration>;
}

export function isConfiguration(conf: any): conf is Configuration {
	return !validateConfiguration(conf).error;
}

export async function loadConfiguration(path: string): Promise<Configuration> {
	return new Promise<Configuration>((resolve, reject) => {
		readFile(path, { encoding: 'utf8' }, (err, data) => {
			if (err) {
				return reject(err);
			}

			const yaml = safeLoadAll(data).shift();
			const result = validateConfiguration(yaml);

			if (result.error) {
				return reject(result.error);
			}
			return resolve(result.value);
		});
	});
}
