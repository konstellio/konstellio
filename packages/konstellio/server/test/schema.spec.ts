import "mocha";
import { expect, should } from "chai";
import { createSchemaFromDefinitions } from "../src/utilities/migration";
import { parse } from "graphql";
import { ColumnType } from "@konstellio/db";
should();

describe("Schema", () => {

	describe('Collections', () => {

		it('parses collection with @collection directive', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				{
					id: ID!
				}

				type NotCollection
				{
					id: ID!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);

			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
		});

		it('collection type', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				{
					id: ID!
				}

				type CollectionB
				@collection(type: "collection")
				{
					id: ID!
				}

				type Structure
				@collection(type: "structure")
				{
					id: ID!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);

			expect(schema.collections.length).to.eq(3);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[1].handle).to.eq('CollectionB');
			expect(schema.collections[2].handle).to.eq('Structure');
		});

	});

	describe('Indexes', () => {

		it('primary index', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_Primary", type: "primary", fields: [{ field: "id", direction: "asc" }] }
				])
				{
					id: ID!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].indexes.length).to.eq(1);
			expect(schema.collections[0].indexes[0].handle).to.eq('CollectionA_Primary');
			expect(schema.collections[0].indexes[0].type).to.eq('primary');
			expect(schema.collections[0].indexes[0].fields.length).to.eq(1);
			expect(schema.collections[0].indexes[0].fields[0].field).to.eq('id');
			expect(schema.collections[0].indexes[0].fields[0].direction).to.eq('asc');
		});

		it('sparse index', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_Sparse", type: "index", fields: [{ field: "id", direction: "asc" }] }
				])
				{
					id: ID!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].indexes.length).to.eq(1);
			expect(schema.collections[0].indexes[0].handle).to.eq('CollectionA_Sparse');
			expect(schema.collections[0].indexes[0].type).to.eq('index');
			expect(schema.collections[0].indexes[0].fields.length).to.eq(1);
			expect(schema.collections[0].indexes[0].fields[0].field).to.eq('id');
			expect(schema.collections[0].indexes[0].fields[0].direction).to.eq('asc');
		});

		it('unique index', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_Unique", type: "unique", fields: [{ field: "id", direction: "asc" }] }
				])
				{
					id: ID!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].indexes.length).to.eq(1);
			expect(schema.collections[0].indexes[0].handle).to.eq('CollectionA_Unique');
			expect(schema.collections[0].indexes[0].type).to.eq('unique');
			expect(schema.collections[0].indexes[0].fields.length).to.eq(1);
			expect(schema.collections[0].indexes[0].fields[0].field).to.eq('id');
			expect(schema.collections[0].indexes[0].fields[0].direction).to.eq('asc');
		});

		it('index on multiple field', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_Sparse", type: "index", fields: [{ field: "id", direction: "asc" }, { field: "date", direction: "asc" }] }
				])
				{
					id: ID!
					date: Date!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].indexes.length).to.eq(1);
			expect(schema.collections[0].indexes[0].handle).to.eq('CollectionA_Sparse');
			expect(schema.collections[0].indexes[0].type).to.eq('index');
			expect(schema.collections[0].indexes[0].fields.length).to.eq(2);
			expect(schema.collections[0].indexes[0].fields[0].field).to.eq('id');
			expect(schema.collections[0].indexes[0].fields[0].direction).to.eq('asc');
			expect(schema.collections[0].indexes[0].fields[1].field).to.eq('date');
			expect(schema.collections[0].indexes[0].fields[1].direction).to.eq('asc');
		});

		it('multiple indexes', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionA
				@collection
				@indexes(indexes: [
					{ handle: "CollectionA_SparseA", type: "index", fields: [{ field: "id", direction: "asc" }] },
					{ handle: "CollectionA_SparseB", type: "index", fields: [{ field: "date", direction: "asc" }] }
				])
				{
					id: ID!
					date: Date!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].indexes.length).to.eq(2);
			expect(schema.collections[0].indexes[0].handle).to.eq('CollectionA_SparseA');
			expect(schema.collections[0].indexes[0].type).to.eq('index');
			expect(schema.collections[0].indexes[0].fields.length).to.eq(1);
			expect(schema.collections[0].indexes[0].fields[0].field).to.eq('id');
			expect(schema.collections[0].indexes[0].fields[0].direction).to.eq('asc');
			expect(schema.collections[0].indexes[1].handle).to.eq('CollectionA_SparseB');
			expect(schema.collections[0].indexes[1].type).to.eq('index');
			expect(schema.collections[0].indexes[1].fields.length).to.eq(1);
			expect(schema.collections[0].indexes[1].fields[0].field).to.eq('date');
			expect(schema.collections[0].indexes[1].fields[0].direction).to.eq('asc');
		});
	});

	describe('Fields', () => {

		it('supported field types', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				scalar Cursor
				scalar Date
				scalar DateTime

				enum EnumA {
					Item1
				}

				type CollectionA
				@collection
				{
					id: ID!
					string: String!
					int: Int!
					float: Float!
					date: Date!
					datetime: DateTime!
					cursor: Cursor!
					enuma: EnumA!
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);

			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].fields.length).to.eq(8);
			expect(schema.collections[0].fields[0].handle).to.eq('id');
			expect(schema.collections[0].fields[0].type).to.eq('text');
			expect(schema.collections[0].fields[1].handle).to.eq('string');
			expect(schema.collections[0].fields[1].type).to.eq('text');
			expect(schema.collections[0].fields[2].handle).to.eq('int');
			expect(schema.collections[0].fields[2].type).to.eq('int');
			expect(schema.collections[0].fields[3].handle).to.eq('float');
			expect(schema.collections[0].fields[3].type).to.eq('float');
			expect(schema.collections[0].fields[4].handle).to.eq('date');
			expect(schema.collections[0].fields[4].type).to.eq('date');
			expect(schema.collections[0].fields[5].handle).to.eq('datetime');
			expect(schema.collections[0].fields[5].type).to.eq('datetime');
			expect(schema.collections[0].fields[6].handle).to.eq('cursor');
			expect(schema.collections[0].fields[6].type).to.eq('blob');
			expect(schema.collections[0].fields[7].handle).to.eq('enuma');
			expect(schema.collections[0].fields[7].type).to.eq('text');
		});

		it('nested field types', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type NotCollectionA {
					id: ID!
					name: String!
				}

				type CollectionA
				@collection
				{
					id: ID!
					subtypea: NotCollectionA
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);

			expect(schema.collections.length).to.eq(1);
			expect(schema.collections[0].handle).to.eq('CollectionA');
			expect(schema.collections[0].fields.length).to.eq(2);
			expect(schema.collections[0].fields[0].handle).to.eq('id');
			expect(schema.collections[0].fields[0].type).to.eq('text');
			expect(schema.collections[0].fields[1].handle).to.eq('subtypea');
			expect(schema.collections[0].fields[1].type).to.eq('blob');
		});

		it('relation field types', async () => {
			const locales = { en: 'English' };
			const definitions = parse(`
				type CollectionB
				@collection
				{
					id: ID!
					name: String!
				}

				type CollectionA
				@collection
				{
					id: ID!
					subtype: CollectionB
				}
			`);
			const schemaA = await createSchemaFromDefinitions(definitions, locales, false);
			expect(schemaA.collections.length).to.eq(2);
			expect(schemaA.collections[0].handle).to.eq('CollectionB');
			expect(schemaA.collections[0].fields.length).to.eq(2);
			expect(schemaA.collections[0].fields[0].handle).to.eq('id');
			expect(schemaA.collections[0].fields[0].type).to.eq('text');
			expect(schemaA.collections[0].fields[1].handle).to.eq('name');
			expect(schemaA.collections[0].fields[1].type).to.eq('text');
			expect(schemaA.collections[1].handle).to.eq('CollectionA');
			expect(schemaA.collections[1].fields.length).to.eq(2);
			expect(schemaA.collections[1].fields[0].handle).to.eq('id');
			expect(schemaA.collections[1].fields[0].type).to.eq('text');
			expect(schemaA.collections[1].fields[1].handle).to.eq('subtype');
			expect(schemaA.collections[1].fields[1].type).to.eq('text');

			const schemaB = await createSchemaFromDefinitions(definitions, locales, true);
			expect(schemaB.collections.length).to.eq(2);
			expect(schemaB.collections[0].handle).to.eq('CollectionB');
			expect(schemaB.collections[0].fields.length).to.eq(2);
			expect(schemaB.collections[0].fields[0].handle).to.eq('id');
			expect(schemaB.collections[0].fields[0].type).to.eq('text');
			expect(schemaB.collections[0].fields[1].handle).to.eq('name');
			expect(schemaB.collections[0].fields[1].type).to.eq('text');
			expect(schemaB.collections[1].handle).to.eq('CollectionA');
			expect(schemaB.collections[1].fields.length).to.eq(1);
			expect(schemaB.collections[1].fields[0].handle).to.eq('id');
			expect(schemaB.collections[1].fields[0].type).to.eq('text');
		});

		it('localized field', async () => {
			const locales = { en: 'English', fr: 'French' };
			const definitions = parse(`
				type CollectionA
				@collection
				{
					id: ID!
				}

				type CollectionB
				@collection
				{
					id: ID!
					title: String! @localized
					dage: Int! @computed
					subtype: CollectionA
				}
			`);
			const schema = await createSchemaFromDefinitions(definitions, locales, false);
			
			expect(schema.collections.length).to.equal(2);
			expect(schema.collections[0].handle).to.equal('CollectionA');
			expect(schema.collections[0].indexes.length).to.equal(0);
			expect(schema.collections[0].fields.length).to.equal(1);
			expect(schema.collections[0].fields[0].handle).to.equal('id');
			expect(schema.collections[0].fields[0].type).to.equal(ColumnType.Text);
			expect(schema.collections[1].handle).to.equal('CollectionB');
			expect(schema.collections[1].indexes.length).to.equal(0);
			expect(schema.collections[1].fields.length).to.equal(4);
			expect(schema.collections[1].fields[0].handle).to.equal('id');
			expect(schema.collections[1].fields[0].type).to.equal(ColumnType.Text);
			expect(schema.collections[1].fields[1].handle).to.equal('title__en');
			expect(schema.collections[1].fields[1].type).to.equal(ColumnType.Text);
			expect(schema.collections[1].fields[2].handle).to.equal('title__fr');
			expect(schema.collections[1].fields[2].type).to.equal(ColumnType.Text);
			expect(schema.collections[1].fields[3].handle).to.equal('subtype');
			expect(schema.collections[1].fields[3].type).to.equal(ColumnType.Text);
		});
	});

});