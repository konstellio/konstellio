import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();

import { Schema, validateSchema, createValidator } from '../src/index';
import * as Joi from 'joi';

describe('Schema', () => {

	const validObject: Schema = {
		handle: 'Post',
		fields: [
			{ handle: 'id', type: 'string', required: true },
			{ handle: 'title', type: 'string', localized: true, required: true },
			{ handle: 'slug', type: 'string', localized: true, required: true },
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

	it('validate schema', async () => {
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