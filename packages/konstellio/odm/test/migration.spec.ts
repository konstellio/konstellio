import 'mocha';
import { use, expect } from 'chai';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractSchemaFromDatabase } from '../src/index';
import { DatabaseSQLite } from '@konstellio/db-sqlite';
import { q, ColumnType, IndexType } from '@konstellio/db';

describe('Migration', () => {

	let db: DatabaseSQLite;

	before(function (done) {
		this.timeout(10000);

		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'konstellio-db-sqlite-'));

		db = new DatabaseSQLite({
			// filename: ':memory:'
			filename: path.join(tmp, 'test.sqlite')
		});

		db.connect()
			.then(() => db.transaction())
			.then(transaction => {
				transaction.execute(q.createCollection('post').define([
					q.column('id', ColumnType.Text),
					q.column('title__fr', ColumnType.Text),
					q.column('title__en', ColumnType.Text),
					q.column('slug__fr', ColumnType.Text),
					q.column('slug__en', ColumnType.Text),
					q.column('postDate', ColumnType.Text)
				], [
					q.index('post_id', IndexType.Primary, [q.sort('id')]),
					q.index('post_slug_u__fr', IndexType.Unique, [q.sort('slug__fr')]),
					q.index('post_slug_u__en', IndexType.Unique, [q.sort('slug__en')]),
					q.index('post_postDate', IndexType.Index, [q.sort('postDate')])
				]));
				return transaction.commit();
			})
			.then(() => done());
	});

	it('extractSchemaFromDatabase', async () => {
		expect(await extractSchemaFromDatabase(db)).to.eql([
			{
				handle: 'post',
				fields: [
					{ handle: 'id', type: 'string', size: -1 },
					{ handle: 'title', type: 'string', size: -1 },
					{ handle: 'slug', type: 'string', size: -1 },
					{ handle: 'postDate', type: 'string', size: -1 }
				],
				indexes: [
					{ handle: 'post_id', type: 'primary', fields: [{ handle: 'id', direction: 'asc' }] },
					{ handle: 'post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'asc' }] },
					{ handle: 'post_slug_u', type: 'unique', fields: [{ handle: 'slug', direction: 'asc' }] }
				]
			}
		]);
	});

});