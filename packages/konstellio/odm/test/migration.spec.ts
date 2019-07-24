import 'mocha';
import { use, expect } from 'chai';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractSchemaFromDatabase, computeLocaleDiff, computeSchemaDiff, Schema, executeDiff } from '../src/index';
import { DatabaseSQLite } from '@konstellio/db-sqlite';
import { q, ColumnType, IndexType, Transaction, Query, QueryCommitResult } from '@konstellio/db';

describe('Migration', () => {
	let db: DatabaseSQLite;

	before(function(done) {
		this.timeout(10000);

		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'konstellio-db-sqlite-'));

		db = new DatabaseSQLite({
			// filename: ':memory:'
			filename: path.join(tmp, 'test.sqlite'),
		});

		db.connect()
			.then(() => db.transaction())
			.then(transaction => {
				transaction.execute(
					q
						.createCollection('Post')
						.define(
							[
								q.column('id', ColumnType.Text),
								q.column('title__fr', ColumnType.Text),
								q.column('title__en', ColumnType.Text),
								q.column('slug__fr', ColumnType.Text),
								q.column('slug__en', ColumnType.Text),
								q.column('postDate', ColumnType.Text),
							],
							[
								q.index('Post_id', IndexType.Primary, [q.sort('id')]),
								q.index('Post_slug_u__fr', IndexType.Unique, [q.sort('slug__fr')]),
								q.index('Post_slug_u__en', IndexType.Unique, [q.sort('slug__en')]),
								q.index('Post_postDate', IndexType.Index, [q.sort('postDate')]),
							]
						)
				);
				return transaction.commit();
			})
			.then(() => done());
	});

	it('extract schema from database', async () => {
		const [schemas, locales] = await extractSchemaFromDatabase(db);
		expect(schemas).to.eql([
			{
				handle: 'Post',
				fields: [
					{ handle: 'id', type: 'string', size: -1 },
					{ handle: 'title', type: 'string', size: -1 },
					{ handle: 'slug', type: 'string', size: -1 },
					{ handle: 'postDate', type: 'string', size: -1 },
				],
				indexes: [
					{ handle: 'Post_id', type: 'primary', fields: [{ handle: 'id', direction: 'asc' }] },
					{ handle: 'Post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'asc' }] },
					{ handle: 'Post_slug_u', type: 'unique', fields: [{ handle: 'slug', direction: 'asc' }] },
				],
			},
			{
				handle: 'Relation',
				fields: [
					{ handle: 'id', type: 'string' },
					{ handle: 'collection', type: 'string' },
					{ handle: 'field', type: 'string' },
					{ handle: 'source', type: 'string' },
					{ handle: 'target', type: 'string' },
					{ handle: 'seq', type: 'int' },
				],
				indexes: [
					{ handle: 'Relation_pk', type: 'primary', fields: [{ handle: 'id' }] },
					{
						handle: 'Relation_collection_field_source',
						type: 'sparse',
						fields: [
							{ handle: 'collection' },
							{ handle: 'field' },
							{ handle: 'source' },
							{ handle: 'seq' },
						],
					},
				],
			},
		]);
		expect(locales).to.eql(['fr', 'en']);
	});

	it('compute locales diff', async () => {
		expect(computeLocaleDiff(['fr'], ['fr'])).to.eql([]);

		expect(computeLocaleDiff(['fr'], ['fr', 'en'])).to.eql([{ action: 'add_locale', locale: 'en' }]);

		expect(computeLocaleDiff(['fr', 'en'], ['fr'])).to.eql([{ action: 'drop_locale', locale: 'en' }]);
	});

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
				{ handle: 'post_slug', type: 'unique', fields: [{ handle: 'slug' }] },
			],
		},
	];
	const target: Schema[] = [
		{
			handle: 'Post',
			fields: [
				{ handle: 'id', type: 'string', required: true },
				{ handle: 'title', type: 'string', localized: true, required: true },
				{ handle: 'slug', type: 'string', localized: true, required: true },
				{ handle: 'postDate', type: 'datetime', required: true },
				{ handle: 'expireDate', type: 'datetime' },
			],
			indexes: [
				{ handle: 'post_id', type: 'primary', fields: [{ handle: 'id' }] },
				{ handle: 'post_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] },
				{ handle: 'post_expireDate', type: 'sparse', fields: [{ handle: 'expireDate', direction: 'desc' }] },
			],
		},
		{
			handle: 'Event',
			fields: [
				{ handle: 'id', type: 'string', required: true },
				{ handle: 'title', type: 'string', localized: true, required: true },
				{ handle: 'slug', type: 'string', localized: true, required: true },
				{ handle: 'content', type: 'string', localized: true },
				{ handle: 'postDate', type: 'datetime', required: true },
				{ handle: 'expireDate', type: 'datetime' },
			],
			indexes: [
				{ handle: 'event_id', type: 'primary', fields: [{ handle: 'id' }] },
				{ handle: 'event_postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] },
				{ handle: 'event_slug', type: 'unique', fields: [{ handle: 'slug' }] },
			],
		},
	];

	it('compute schemas diff', async () => {
		const diffs = [
			...computeSchemaDiff(source, target, (a, b) => a.type === b.type && a.size === b.size),
			...computeLocaleDiff(['fr'], ['fr', 'en']),
		];

		expect(diffs).to.eql([
			{
				action: 'add_index',
				collection: 'Post',
				index: {
					handle: 'post_expireDate',
					type: 'sparse',
					fields: [{ handle: 'expireDate', direction: 'desc' }],
				},
			},
			{
				action: 'drop_index',
				collection: 'Post',
				index: 'post_slug',
			},
			{
				action: 'add_field',
				collection: 'Post',
				field: { handle: 'expireDate', type: 'datetime' },
			},
			{
				action: 'drop_field',
				collection: 'Post',
				field: 'content',
			},
			{
				action: 'add_collection',
				collection: target[1],
			},
			{
				action: 'add_locale',
				locale: 'en',
			},
		]);
	});

	class DummyTransaction extends Transaction {
		constructor(public queries: [string | Query, any | undefined][] = []) {
			super();
		}

		execute<T>(query: any, variables?: any): Promise<any> {
			this.queries.push([query, variables]);
			return {} as any;
		}

		async commit(): Promise<QueryCommitResult> {
			throw new Error(`Dummy`);
		}

		async rollback(): Promise<void> {
			throw new Error(`Dummy`);
		}
	}

	it('execute diffs', async () => {
		const diffs = [
			...computeSchemaDiff(source, target, (a, b) => a.type === b.type && a.size === b.size),
			...computeLocaleDiff(['fr'], ['fr', 'en']),
		];

		const transaction = new DummyTransaction();

		executeDiff(transaction, target, diffs);

		expect(transaction.queries.map(q => q.toString())).to.eql([
			'CREATE COLLECTION Event ( id TEXT, title TEXT, slug TEXT, content TEXT, postDate DATETIME, expireDate DATETIME )  INDEXES ( PRIMARY event_id (id ASC), INDEX event_postDate (postDate DESC), UNIQUE event_slug (slug ASC) ),',
			'ALTER COLLECTION Post ( ADDIDX INDEX post_expireDate (expireDate DESC), DROPIDX post_slug, ADDCOL expireDate DATETIME, DROPCOL content, ADDCOL title__en TEXT, ADDCOL slug__en TEXT ),',
			'ALTER COLLECTION Event ( ADDCOL title__en TEXT, ADDCOL slug__en TEXT, ADDCOL content__en TEXT ),',
		]);
	});
});
