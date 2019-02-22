import 'mocha';
import { expect } from 'chai';

import { isConfiguration, validateConfiguration, loadConfiguration } from '../src/config';
import { join } from 'path';

describe('Config', () => {
	
	it('validate', async () => {
		
		expect(isConfiguration({})).to.eq(false);
		expect(isConfiguration({ secret: '1234' })).to.eq(true);
		expect(validateConfiguration({ secret: '1234' }).value).to.eql({
			secret: '1234',
			generate: {
				language: 'typescript',
				destination: './src/generated/konstellio'
			},
			database: {
				driver: '@konstellio/db-sqlite',
				filename: './db.sqlite'
			},
			filesystem: {
				driver: '@konstellio/fs-local',
				rootDirectory: './storage'
			},
			cache: {
				driver: '@konstellio/cache-memory'
			},
			mq: {
				driver: '@konstellio/mq-memory'
			}
		});

		expect(isConfiguration({ secret: '1234', extensions: [] })).to.eq(false);
		expect(isConfiguration({ secret: '1234', locales: [] })).to.eq(false);

	});

	it('load configuration from yaml', async () => {
		const conf = await loadConfiguration(join(__dirname, 'config.yml'));
		expect(conf).to.eql({
			secret: '1234',
			generate: {
				language: 'typescript',
				destination: './src/generated/konstellio'
			},
			locales: {
				fr: 'Français',
				en: 'English'
			},
			extensions: [
				'./dist/blog.js'
			],
			database: {
				driver: '@konstellio/db-sqlite',
				filename: './db.sqlite'
			},
			filesystem: {
				driver: '@konstellio/fs-local',
				rootDirectory: './storage'
			},
			cache: {
				driver: '@konstellio/cache-memory'
			},
			mq: {
				driver: '@konstellio/mq-memory'
			}
		});
	});

});