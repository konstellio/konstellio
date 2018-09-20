import "mocha";
import { expect, should } from "chai";
import { createSchemaFromDefinitions, createSchemaFromDatabase, computeSchemaDiff, executeSchemaDiff } from "../src/utilities/migration";
import { parse } from "graphql";
import { DatabaseSQLite } from "@konstellio/db-sqlite";
import { ColumnType, Column, q } from "@konstellio/db";
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

			expect(JSON.stringify(schemaDiffs)).to.eql('[{"action":"add_collection","collection":{"handle":"CollectionA","indexes":[],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title","type":"text","size":-1}]},"sourceSchema":{"collections":[]}}]');
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

			expect(JSON.stringify(schemaDiffs)).to.eql('[{"action":"add_collection","collection":{"handle":"CollectionA","indexes":[],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title__en","type":"text","size":-1},{"handle":"title__fr","type":"text","size":-1}]},"sourceSchema":{"collections":[]}}]');
		});

		it('indexed collection table', async () => {
			const db = await new DatabaseSQLite({ filename: ':memory:' }).connect();
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_id", type: "primary", fields: [{ field: "id", direction: "asc" }] }
				])
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
							{ handle: 'CollectionA_id', type: 'primary', fields: [{ field: 'id', direction: 'asc' }] }
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
				@indexes(indexes: [
					{ handle: "CollectionA_id", type: "primary", fields: [{ field: "id", direction: "asc" }] }
				])
				{
					id: ID!
					title: String! @localized
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			expect(JSON.stringify(schemaDiffs)).to.eql('[{"sourceCollection":{"handle":"CollectionA","indexes":[{"handle":"CollectionA_id","type":"primary","fields":[{"field":"id","direction":"asc"}]}],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title","type":"text","size":-1}]},"action":"add_field","collection":{"handle":"CollectionA","indexes":[{"handle":"CollectionA_id","type":"primary","fields":[{"field":"id","direction":"asc"}]}],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title__en","type":"text","size":-1},{"handle":"title__fr","type":"text","size":-1}]},"field":{"handle":"title__en","type":"text","size":-1}},{"sourceCollection":{"handle":"CollectionA","indexes":[{"handle":"CollectionA_id","type":"primary","fields":[{"field":"id","direction":"asc"}]}],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title","type":"text","size":-1}]},"action":"add_field","collection":{"handle":"CollectionA","indexes":[{"handle":"CollectionA_id","type":"primary","fields":[{"field":"id","direction":"asc"}]}],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title__en","type":"text","size":-1},{"handle":"title__fr","type":"text","size":-1}]},"field":{"handle":"title__fr","type":"text","size":-1}},{"action":"drop_field","collection":{"handle":"CollectionA","indexes":[{"handle":"CollectionA_id","type":"primary","fields":[{"field":"id","direction":"asc"}]}],"fields":[{"handle":"id","type":"text","size":-1},{"handle":"title__en","type":"text","size":-1},{"handle":"title__fr","type":"text","size":-1}]},"field":{"handle":"title","type":"text","size":-1}}]');
		});
	});

	describe('execute diff', () => {
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

			await executeSchemaDiff(schemaDiffs, db);

			const desc = await db.execute(q.describeCollection('CollectionA'));

			expect(JSON.stringify(desc)).to.eql('{"collection":{"name":"CollectionA"},"columns":[{"name":"id","type":"text","size":-1,"defaultValue":null,"autoIncrement":false},{"name":"title","type":"text","size":-1,"defaultValue":null,"autoIncrement":false}],"indexes":[]}');
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

			await executeSchemaDiff(schemaDiffs, db);

			const desc = await db.execute(q.describeCollection('CollectionA'));
			expect(JSON.stringify(desc)).to.eql('{"collection":{"name":"CollectionA"},"columns":[{"name":"id","type":"text","size":-1,"defaultValue":null,"autoIncrement":false},{"name":"title__en","type":"text","size":-1,"defaultValue":null,"autoIncrement":false},{"name":"title__fr","type":"text","size":-1,"defaultValue":null,"autoIncrement":false}],"indexes":[]}');
		});

		it('indexed collection table', async () => {
			const db = await new DatabaseSQLite({ filename: ':memory:' }).connect();
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_id", type: "primary", fields: [{ field: "id", direction: "asc" }] }
				])
				{
					id: ID!
					title: String!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			await executeSchemaDiff(schemaDiffs, db);

			const desc = await db.execute(q.describeCollection('CollectionA'));
			expect(JSON.stringify(desc)).to.eql('{"collection":{"name":"CollectionA"},"columns":[{"name":"id","type":"text","size":-1,"defaultValue":null,"autoIncrement":false},{"name":"title","type":"text","size":-1,"defaultValue":null,"autoIncrement":false}],"indexes":[{"name":"CollectionA_id","type":"primary","columns":[{"field":{"name":"id"},"direction":"asc"}]}]}');
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
				@indexes(indexes: [
					{ handle: "CollectionA_id", type: "primary", fields: [{ field: "id", direction: "asc" }] }
				])
				{
					id: ID!
					title: String! @localized
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			const dbSchema = await createSchemaFromDatabase(db, locales);
			const schemaDiffs = computeSchemaDiff(dbSchema, schema, db.compareTypes);

			await executeSchemaDiff(schemaDiffs, db);

			const desc = await db.execute(q.describeCollection('CollectionA'));
			expect(JSON.stringify(desc)).to.eql('{"collection":{"name":"CollectionA"},"columns":[{"name":"id","type":"text","size":-1,"defaultValue":null,"autoIncrement":false},{"name":"title__en","type":"text","size":-1,"defaultValue":null,"autoIncrement":false},{"name":"title__fr","type":"text","size":-1,"defaultValue":null,"autoIncrement":false}],"indexes":[]}');
		});
	});

});