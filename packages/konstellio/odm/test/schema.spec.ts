import 'mocha';
import { use, expect, should } from 'chai';
use(require("chai-as-promised"));
should();

import { Schema, validateSchema, createValidator } from '../src/index';
import * as Joi from 'joi';

describe('Schema', () => {

	const validPostSchema: Schema = {
		handle: 'Post',
		fields: [{
			handle: 'id',
			type: 'string',
		}, {
			handle: 'title',
			type: 'string',
			localized: true
		}, {
			handle: 'slug',
			type: 'string',
			localized: true
		}, {
			handle: 'content',
			type: 'string',
			localized: true
		}, {
			handle: 'postDate',
			type: 'datetime'
		}, {
			handle: 'expireDate',
			type: 'datetime'
		}],
		indexes: [{
			handle: 'primary',
			type: 'primary',
			fields: [{ handle: 'id' }]
		}, {
			handle: 'postDate',
			type: 'sparse',
			fields: [{ handle: 'postDate', direction: 'desc' }]
		}, {
			handle: 'slug',
			type: 'unique',
			fields: [{ handle: 'slug' }]
		}]
	};

	it('validate schema', async () => {
		expect(() => validateSchema(validPostSchema)).to.not.throw();
		expect(validateSchema(validPostSchema)).to.eq(true);
		expect(() => validateSchema({})).to.not.throw();
		expect(validateSchema({})).to.eq(false);
		const errors: any[] = [];
		expect(validateSchema({}, errors)).to.eq(false);
		expect(errors.length).to.eq(1);
	});

	it('create validator from schema', async () => {
		expect(() => createValidator(validPostSchema, [])).to.not.throw();
		// expect(createValidator(validPostSchema, [])).to.be.an.instanceof(Joi.Schema);

		console.log(Joi.describe(createValidator(validPostSchema, [])));
		debugger;
	});

});