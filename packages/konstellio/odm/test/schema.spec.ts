import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();

import { Schema, validateSchema, createValidator, ObjectBase } from '../src/index';
import * as Joi from 'joi';

describe('Schema', () => {

	const relatedObject: ObjectBase = {
		handle: 'PostCategory',
		fields: [
			{ handle: 'id', type: 'string' },
			{ handle: 'title', type: 'string' },
		]
	};

	const validObject: Schema = {
		handle: 'Post',
		fields: [
			{ handle: 'id', type: 'string', required: true },
			{ handle: 'title', type: 'string', localized: true, required: true },
			{ handle: 'slug', type: 'string', localized: true, required: true },
			{ handle: 'category', type: relatedObject, localized: true, multiple: true },
			{ handle: 'content', type: 'string', localized: true },
			{ handle: 'postDate', type: 'datetime', required: true },
			{ handle: 'expireDate', type: 'datetime' }
		],
		indexes: [
			{ handle: 'primary', type: 'primary', fields: [{ handle: 'id' }] },
			{ handle: 'postDate', type: 'sparse', fields: [{ handle: 'postDate', direction: 'desc' }] },
			{ handle: 'slug', type: 'unique', fields: [{ handle: 'slug' }] }
		]
	};

	const validUnion: Schema = {
		handle: 'Product',
		objects: [
			{
				handle: 'Physical',
				fields: [
					{ handle: 'id', type: 'string', required: true },
					{ handle: 'sku', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'price', type: 'float', required: true },
					{ handle: 'weight', type: 'float' },
					{ handle: 'width', type: 'float' },
					{ handle: 'height', type: 'float' },
					{ handle: 'depth', type: 'float' },
				]
			}, {
				handle: 'Virtual',
				fields: [
					{ handle: 'id', type: 'string', required: true },
					{ handle: 'sku', type: 'string', required: true },
					{ handle: 'title', type: 'string', localized: true, required: true },
					{ handle: 'price', type: 'float', required: true },
					{ handle: 'size', type: 'float' }
				]
			}
		],
		indexes: [
			{ handle: 'primary', type: 'primary', fields: [{ handle: 'id' }] },
			{ handle: 'sku', type: 'unique', fields: [{ handle: 'sku' }] },
			{ handle: 'price', type: 'sparse', fields: [{ handle: 'price' }] },
		]
	};

	it('fails on empty schema', async () => {
		expect(() => validateSchema({})).to.not.throw();
		expect(validateSchema({})).to.eq(false);
		expect(validateSchema({
			handle: 'emptyobject',
			fields: [],
			indexes: []
		})).to.eq(false);
		expect(validateSchema({
			handle: 'emptyunion',
			objects: [],
			indexes: []
		})).to.eq(false);
		expect(validateSchema({
			handle: 'unionemptyobject',
			objects: [{ handle: 'emptyobject', fields: [], indexes: [] }],
			indexes: []
		})).to.eq(false);
	});

	it('field type text', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'text' }],
			indexes: []
		})).to.eq(true);
	});

	it('field type int', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'int' }],
			indexes: []
		})).to.eq(true);
	});

	it('field type float', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'float' }],
			indexes: []
		})).to.eq(true);
	});

	it('field type boolean', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'boolean' }],
			indexes: []
		})).to.eq(true);
	});

	it('field type date', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'date' }],
			indexes: []
		})).to.eq(true);
	});

	it('field type datetime', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'datetime' }],
			indexes: []
		})).to.eq(true);
	});

	it('field type subschema', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{
				handle: 'asubschema',
				type: {
					handle: 'subschema',
					fields: [{ handle: 'subfield', type: 'text' }]
				}
			}],
			indexes: []
		})).to.eq(true);
		expect(validateSchema({
			handle: 'schema',
			fields: [{
				handle: 'asubschema',
				type: {
					handle: 'subschema',
					fields: [{ handle: 'subfield', type: 'text' }],
					indexes: []
				}
			}],
			indexes: []
		})).to.eq(false);
		expect(validateSchema({
			handle: 'schema',
			fields: [{
				handle: 'asubschema',
				type: {
					handle: 'subschema',
					fields: [{ handle: 'subfield', type: 'text' }],
					indexes: []
				},
				relation: true
			}],
			indexes: []
		})).to.eq(true);
	});

	it('schema union', async () => {
		expect(validateSchema({
			handle: 'union',
			objects: [{
				handle: 'A',
				fields: [{ handle: 'field', type: 'text' }]
			}],
			indexes: []
		})).to.eq(true);
		expect(validateSchema({
			handle: 'union',
			objects: [{
				handle: 'A',
				fields: [{ handle: 'field', type: 'text' }]
			}, {
				handle: 'B',
				fields: [{ handle: 'field', type: 'text' }]
			}],
			indexes: []
		})).to.eq(true);
		expect(validateSchema({
			handle: 'union',
			objects: [{
				handle: 'A',
				fields: [{ handle: 'field', type: 'text' }]
			}, {
				handle: 'B',
				fields: [{ handle: 'field', type: 'int' }]
			}],
			indexes: []
		})).to.eq(false);
	});

	it('indexes', async () => {
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'text' }],
			indexes: [{ handle: 'index_field', type: 'index', fields: [] }]
		})).to.eq(false);
		expect(validateSchema({
			handle: 'schema',
			objects: [{
				handle: 'subschema',
				fields: [{ handle: 'field', type: 'text' }]
			}],
			indexes: [{ handle: 'index_field', type: 'index', fields: [] }]
		})).to.eq(false);
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'text' }],
			indexes: [{ handle: 'index_field', type: 'index', fields: [{ handle: 'nonfield' }] }]
		})).to.eq(false);
		expect(validateSchema({
			handle: 'schema',
			objects: [{
				handle: 'subschema',
				fields: [{ handle: 'field', type: 'text' }]
			}],
			indexes: [{ handle: 'index_field', type: 'index', fields: [{ handle: 'nonfield' }] }]
		})).to.eq(false);
		expect(validateSchema({
			handle: 'schema',
			fields: [{ handle: 'field', type: 'text' }],
			indexes: [{ handle: 'index_field', type: 'index', fields: [{ handle: 'field' }] }]
		})).to.eq(true);
		expect(validateSchema({
			handle: 'schema',
			objects: [{
				handle: 'subschema',
				fields: [{ handle: 'field', type: 'text' }]
			}],
			indexes: [{ handle: 'index_field', type: 'index', fields: [{ handle: 'field' }] }]
		})).to.eq(true);
		expect(validateSchema({
			handle: 'schema',
			objects: [{
				handle: 'subschemaa',
				fields: [{ handle: 'field', type: 'text' }]
			}, {
				handle: 'subschemab',
				fields: [{ handle: 'otherfield', type: 'text' }]
			}],
			indexes: [{ handle: 'index_field', type: 'index', fields: [{ handle: 'otherfield' }] }]
		})).to.eq(true);
	});

	it('complexe schema', async () => {
		expect(() => validateSchema(validObject)).to.not.throw();
		expect(() => validateSchema(validUnion)).to.not.throw();
		expect(validateSchema(validObject)).to.eq(true);
		expect(validateSchema(validUnion)).to.eq(true);
		expect(() => validateSchema({})).to.not.throw();
		expect(validateSchema({})).to.eq(false);
		const errors: any[] = [];
		expect(validateSchema({}, errors)).to.eq(false);
		expect(errors.length).to.eq(2);
	});

	it('create validator from schema', async () => {
		expect(() => createValidator(validObject, [])).to.not.throw();

		const res = createValidator(validObject, []).validate({
			id: 'my-id',
			title: 'My title',
			slug: 'my-title',
			postDate: new Date()
		});
		expect(res.error).to.eq(null);
	});

});