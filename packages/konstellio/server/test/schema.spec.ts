import "mocha";
import { expect, should } from "chai";
import { createSchemaFromDefinitions } from "../src/utilities/migration";
import { parse } from "graphql";
import { ColumnType } from "@konstellio/db/src";
should();

describe("Schema", () => {

	it('only parse @collection', async () => {
		const locales = { en: 'English' };
		const definitions = parse(`
		 	type TypeA
			@collection
			{
				id: ID!
			}

			type TypeB
			{
				id: ID!
			}
		`);
		const schema = await createSchemaFromDefinitions(definitions, locales, false);

		expect(schema.collections.length).to.eq(1);
		expect(schema.collections[0].handle).to.eq('TypeA');
	});

	it('supported field types', async () => {
		const locales = { en: 'English' };
		const definitions = parse(`
			scalar Cursor
			scalar Date
			scalar DateTime

			enum EnumA {
				Item1
			}

		 	type TypeA
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
		expect(schema.collections[0].handle).to.eq('TypeA');
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
			type SubTypeA {
				id: ID!
				name: String!
			}

		 	type TypeA
			@collection
			{
				id: ID!
				subtypea: SubTypeA
			}
		`);
		const schema = await createSchemaFromDefinitions(definitions, locales, false);

		expect(schema.collections.length).to.eq(1);
		expect(schema.collections[0].handle).to.eq('TypeA');
		expect(schema.collections[0].fields.length).to.eq(2);
		expect(schema.collections[0].fields[0].handle).to.eq('id');
		expect(schema.collections[0].fields[0].type).to.eq('text');
		expect(schema.collections[0].fields[1].handle).to.eq('subtypea');
		expect(schema.collections[0].fields[1].type).to.eq('blob');
	});

	it('relation field types', async () => {
		const locales = { en: 'English' };
		const definitions = parse(`
			type SubTypeA
			@collection
			{
				id: ID!
				name: String!
			}

		 	type TypeA
			@collection
			{
				id: ID!
				subtype: SubTypeA
			}
		`);
		const schemaA = await createSchemaFromDefinitions(definitions, locales, false);
		expect(schemaA.collections.length).to.eq(2);
		expect(schemaA.collections[0].handle).to.eq('SubTypeA');
		expect(schemaA.collections[0].fields.length).to.eq(2);
		expect(schemaA.collections[0].fields[0].handle).to.eq('id');
		expect(schemaA.collections[0].fields[0].type).to.eq('text');
		expect(schemaA.collections[0].fields[1].handle).to.eq('name');
		expect(schemaA.collections[0].fields[1].type).to.eq('text');
		expect(schemaA.collections[1].handle).to.eq('TypeA');
		expect(schemaA.collections[1].fields.length).to.eq(2);
		expect(schemaA.collections[1].fields[0].handle).to.eq('id');
		expect(schemaA.collections[1].fields[0].type).to.eq('text');
		expect(schemaA.collections[1].fields[1].handle).to.eq('subtype');
		expect(schemaA.collections[1].fields[1].type).to.eq('text');

		const schemaB = await createSchemaFromDefinitions(definitions, locales, true);
		expect(schemaB.collections.length).to.eq(2);
		expect(schemaB.collections[0].handle).to.eq('SubTypeA');
		expect(schemaB.collections[0].fields.length).to.eq(2);
		expect(schemaB.collections[0].fields[0].handle).to.eq('id');
		expect(schemaB.collections[0].fields[0].type).to.eq('text');
		expect(schemaB.collections[0].fields[1].handle).to.eq('name');
		expect(schemaB.collections[0].fields[1].type).to.eq('text');
		expect(schemaB.collections[1].handle).to.eq('TypeA');
		expect(schemaB.collections[1].fields.length).to.eq(1);
		expect(schemaB.collections[1].fields[0].handle).to.eq('id');
		expect(schemaB.collections[1].fields[0].type).to.eq('text');
	});

	// it('extract schema from definition', async () => {

	// 	const locales = { en: 'English', fr: 'French' };
	// 	const definitions = parse(`
	// 		type TypeA
	// 		@collection
	// 		{
	// 			id: ID!
	// 		}

	// 		type TypeB
	// 		@collection
	// 		{
	// 			id: ID!
	// 			title: String! @localized
	// 			dage: Int! @computed
	// 		}
	// 	`);
	// 	const schema = await createSchemaFromDefinitions(definitions, locales);
		
	// 	expect(schema.collections.length).to.equal(2);
	// 	expect(schema.collections[0].handle).to.equal('TypeA');
	// 	expect(schema.collections[0].indexes.length).to.equal(0);
	// 	expect(schema.collections[0].fields.length).to.equal(1);
	// 	expect(schema.collections[0].fields[0].handle).to.equal('id');
	// 	expect(schema.collections[0].fields[0].type).to.equal(ColumnType.Text);
	// 	expect(schema.collections[1].handle).to.equal('TypeB');
	// 	expect(schema.collections[1].indexes.length).to.equal(0);
	// 	expect(schema.collections[1].fields.length).to.equal(3);
	// 	expect(schema.collections[1].fields[0].handle).to.equal('id');
	// 	expect(schema.collections[1].fields[0].type).to.equal(ColumnType.Text);
	// 	expect(schema.collections[1].fields[1].handle).to.equal('title__en');
	// 	expect(schema.collections[1].fields[1].type).to.equal(ColumnType.Text);
	// 	expect(schema.collections[1].fields[2].handle).to.equal('title__fr');
	// 	expect(schema.collections[1].fields[2].type).to.equal(ColumnType.Text);
	// });

});