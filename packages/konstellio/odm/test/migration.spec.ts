import 'mocha';
import { use, expect } from 'chai';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractSchemaFromDatabase, computeLocaleDiff, computeSchemaDiff, Schema } from '../src/index';
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

	it('extract schema from database', async () => {
		const [schemas, locales] = await extractSchemaFromDatabase(db);
		expect(schemas).to.eql([
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
		expect(locales).to.eql(['fr', 'en']);
	});

	it('compute locales diff', async () => {
		expect(computeLocaleDiff(['fr'], ['fr'])).to.eql([]);

		expect(computeLocaleDiff(['fr'], ['fr', 'en'])).to.eql([
			{ action: 'add_locale', locale: 'en' }
		]);

		expect(computeLocaleDiff(['fr', 'en'], ['fr'])).to.eql([
			{ action: 'drop_locale', locale: 'en' }
		]);
	});

	it('compute schemas diff', async () => {
		const source: Schema[] = [
			{
				handle: 'Post',
				fields: [
					{ handle: 'id', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'slug', type: 'string', localized: true, required: true },
					{ handle: 'content', type: 'string', localized: true },
					{ handle: 'postDate', type: 'datetime', required: true },
				],
				indexes: [
					{ handle: 'post_id', type: 'primary', fields: [{ handle: 'id' }] },
					{ handle: 'post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] },
					{ handle: 'post_slug', type: 'unique', fields: [{ handle: 'slug' }] }
				]
			}
		];
		const target: Schema[] = [
			{
				handle: 'Post',
				fields: [
					{ handle: 'id', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'slug', type: 'string', localized: true, required: true },
					{ handle: 'postDate', type: 'datetime', required: true },
					{ handle: 'expireDate', type: 'datetime' }
				],
				indexes: [
					{ handle: 'post_id', type: 'primary', fields: [{ handle: 'id' }] },
					{ handle: 'post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] },
					{ handle: 'post_expireDate', type: 'sparse', fields: [{ handle: 'expireDate', direction: 'desc' }] },
				]
			},
			{
				handle: 'Event',
				fields: [
					{ handle: 'id', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'slug', type: 'string', localized: true, required: true },
					{ handle: 'content', type: 'string', localized: true },
					{ handle: 'postDate', type: 'datetime', required: true },
					{ handle: 'expireDate', type: 'datetime' }
				],
				indexes: [
					{ handle: 'event_id', type: 'primary', fields: [{ handle: 'id' }] },
					{ handle: 'event_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] },
					{ handle: 'event_slug', type: 'unique', fields: [{ handle: 'slug' }] }
				]
			}
		];

		const diffs = [
			...computeSchemaDiff(source, target, (a, b) => a.type === b.type && a.size === b.size),
			...computeLocaleDiff(['fr'], ['fr', 'en'])
		];

		expect(diffs).to.eql([
			{
				action: 'add_index',
				collection: 'Post',
				index: { handle: 'post_expireDate', type: 'sparse', fields: [{ handle: 'expireDate', direction: 'desc' }] }
			},
			{
				action: 'drop_index',
				collection: 'Post',
				index: 'post_slug'
			},
			{
				action: 'add_field',
				collection: 'Post',
				field: { handle: 'expireDate', type: 'datetime' }
			},
			{
				action: 'drop_field',
				collection: 'Post',
				field: 'content'
			},
			{
				action: 'add_collection',
				collection: target[1]
			},
			{
				action: 'add_locale',
				locale: 'en'
			}
		]);
	});

});