import 'mocha';
import { expect } from 'chai';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { join } from 'path';

import { createServer } from '../src/server';
import { q, ColumnType, IndexType } from '@konstellio/db';
import { executeDiff, computeSchemaDiff, extractSchemaFromDatabase } from '@konstellio/odm';
import { hashPassword } from '../src/extension/auth';

describe('Server', () => {

	const tmp = mkdtempSync(join(tmpdir(), 'konstellio-server-'));

	it('createServer', async () => {

		console.log(join(tmp, 'db.sqlite'));

		const { app, graphQLSchema, configuration, context, collectionSchemas } = await createServer({
			basedir: __dirname,
			configuration: {
				secret: '1234',
				generate: {
					language: 'typescript',
					destination: join(tmp, 'generated')
				},
				database: {
					driver: '@konstellio/db-sqlite',
					filename: join(tmp, 'db.sqlite')
				},
				filesystem: {
					driver: '@konstellio/fs-local',
					rootDirectory: join(tmp, 'storage')
				},
				cache: {
					driver: '@konstellio/cache-memory'
				},
				mq: {
					driver: '@konstellio/mq-memory'
				}
			}
		});

		// Create fake database...
		{
			const transaction = await context.database.transaction();

			const [dbSchemas, dbLocales] = await extractSchemaFromDatabase(context.database);

			const diffs = computeSchemaDiff(
				[],
				[
					...collectionSchemas,
					...dbSchemas
				],
				(a, b) => a.type === b.type && a.size === b.size
			);
			executeDiff(transaction, collectionSchemas, diffs);

			transaction.execute(q.insert('UserGroup').add({
				id: 'group-super', // context.collection.UserGroup.generateId(),
				name: 'super'
			}));

			transaction.execute(q.insert('User').add({
				id: 'user-admin', // context.collection.User.generateId(),
				username: 'admin',
				password: await hashPassword('test1234')
			}));

			transaction.execute(q.insert('Relation').add({
				id: context.collection.User.generateId(),
				collection: 'UserGroup',
				field: 'roles',
				source: 'group-super',
				target: 'super',
				seq: 1
			}));

			transaction.execute(q.insert('Relation').add({
				id: context.collection.User.generateId(),
				collection: 'User',
				field: 'groups',
				source: 'user-admin',
				target: 'group-super',
				seq: 1
			}));

			await transaction.commit();
		}

		await app.listen(3000);

		await new Promise(resolve => setTimeout(resolve, 6000000));

	});

});