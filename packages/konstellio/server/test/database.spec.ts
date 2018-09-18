import "mocha";
import { expect, should } from "chai";
import { createSchemaFromDefinitions, createSchemaFromDatabase, computeSchemaDiff } from "../src/utilities/migration";
import { parse } from "graphql";
import { DatabaseSQLite } from "@konstellio/db-sqlite";
import { ColumnType } from "@konstellio/db";
should();

describe('Database', () => {

	describe('calc schema diff', () => {

		it('simple collection table', async () => {
			const db = await new DatabaseSQLite({ filename: ':memory:' }).connect();
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				{
					id: ID!
					title: String!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			expect(schemaDiffs).to.eql([
				{
					action: 'add_collection',
					collection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title', size: -1, type: ColumnType.Text }
						],
						indexes: []
					},
					sourceSchema: {
						collections: []
					}
				}
			]);
		});

		it('localized collection table', async () => {
			const db = await new DatabaseSQLite({ filename: ':memory:' }).connect();
			const locales = { en: 'English', fr: 'French' };
			const definitions = parse(`
				type CollectionA
				@collection
				{
					id: ID!
					title: String! @localized
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			expect(schemaDiffs).to.eql([
				{
					action: 'add_collection',
					collection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title__en', size: -1, type: ColumnType.Text },
							{ handle: 'title__fr', size: -1, type: ColumnType.Text }
						],
						indexes: []
					},
					sourceSchema: {
						collections: []
					}
				}
			]);
		});

		it('indexed collection table', async () => {
			const db = await new DatabaseSQLite({ filename: ':memory:' }).connect();
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@index(handle: "CollectionA_Primary", type: "primary", fields: [{ field: "id", direction: "asc" }])
				{
					id: ID!
					title: String!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			expect(schemaDiffs).to.eql([
				{
					action: 'add_collection',
					collection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title', size: -1, type: ColumnType.Text }
						],
						indexes: [
							{ handle: 'CollectionA_Primary', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
						]
					},
					sourceSchema: {
						collections: []
					}
				}
			]);
		});

		it('simple collection table from existing table', async () => {
			const db = await new DatabaseSQLite({ filename: ':memory:' }).connect();

			const trnx = await db.transaction();
			trnx.execute('CREATE TABLE CollectionA (id TEXT PRIMARY KEY, title TEXT)');
			await trnx.commit();

			const locales = { en: 'English', fr: 'French' };
			const definitions = parse(`
				type CollectionA
				@collection
				@index(handle: "CollectionA_id", type: "primary", fields: [{ field: "id", direction: "asc" }])
				{
					id: ID!
					title: String! @localized
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			expect(schemaDiffs).to.eql([
				{
					action: 'add_field',
					collection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title__en', size: -1, type: ColumnType.Text },
							{ handle: 'title__fr', size: -1, type: ColumnType.Text }
						],
						indexes: [
							{ handle: 'CollectionA_id', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
						]
					},
					field: {
						handle: 'title__en',
						size: -1,
						type: ColumnType.Text
					},
					sourceCollection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title', size: -1, type: ColumnType.Text },
						],
						indexes: [
							{ handle: 'CollectionA_id', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
						]
					}
				},
				{
					action: 'add_field',
					collection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title__en', size: -1, type: ColumnType.Text },
							{ handle: 'title__fr', size: -1, type: ColumnType.Text }
						],
						indexes: [
							{ handle: 'CollectionA_id', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
						]
					},
					field: {
						handle: 'title__fr',
						size: -1,
						type: ColumnType.Text
					},
					sourceCollection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title', size: -1, type: ColumnType.Text },
						],
						indexes: [
							{ handle: 'CollectionA_id', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
						]
					}
				},
				{
					action: 'drop_field',
					collection: {
						handle: 'CollectionA',
						fields: [
							{ handle: 'id', size: -1, type: ColumnType.Text },
							{ handle: 'title__en', size: -1, type: ColumnType.Text },
							{ handle: 'title__fr', size: -1, type: ColumnType.Text }
						],
						indexes: [
							{ handle: 'CollectionA_id', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
						]
					},
					field: {
						handle: 'title',
						size: -1,
						type: ColumnType.Text
					}
				}
			]);
		});

	});

	xdescribe('execute diff', () => {

	});

});