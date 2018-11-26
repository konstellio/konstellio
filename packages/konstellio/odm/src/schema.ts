import * as Joi from 'joi';

export interface Schema {
	handle: string;
	fields: Field[];
	indexes: Indexes[];
}

export type FieldType = 'string'
	| 'int'
	| 'float'
	| 'boolean'
	| 'date'
	| 'datetime'
	| Schema;

export interface Field {
	handle: string;
	type: FieldType;
	size?: number;
	required?: boolean;
	localized?: boolean;
}

export type IndexType = 'primary'
	| 'unique'
	| 'sparse';

export interface IndexField {
	handle: string;
	direction?: 'asc' | 'desc';
}

export interface Indexes {
	handle: string;
	type: IndexType;
	fields: IndexField[];
}

const fieldTypeValidator = Joi.alternatives().try(
	Joi.string().allow('int', 'float', 'boolean', 'date', 'datetime'),
	Joi.lazy(() => schemaValidator)
);

const fieldValidator = Joi.object().keys({
	handle: Joi.string().required(),
	type: fieldTypeValidator.required(),
	size: Joi.number().min(1),
	required: Joi.boolean(),
	localized: Joi.boolean()
});

const indexTypeValidator = Joi.string().allow('primary', 'unique', 'sparse');

const indexValidator = Joi.object().keys({
	handle: Joi.string().required(),
	type: indexTypeValidator.required(),
	fields: Joi.array().items(Joi.object().keys({
		handle: Joi.string().required(),
		direction: Joi.string().allow('asc', 'desc')
	}))
});

const schemaValidator = Joi.object().keys({
	handle: Joi.string().required(),
	fields: Joi.array().items(fieldValidator).required(),
	indexes: Joi.array().items(indexValidator).required()
});

export function validateSchema(schema: any, errors?: Joi.ValidationErrorItem[]): schema is Schema {
	const result = Joi.validate(schema, schemaValidator);

	if (result.error) {
		if (errors) {
			errors.push(...result.error.details);
		}
		return false;
	}

	return true;
}

export function createValidator(schema: Schema, locales: string[]): Joi.Schema {
	return Joi.object().keys(schema.fields.reduce((keys, field) => {
		if (field.localized && locales.length) {
			const validation = transformTypeToValidation(field.type);
			keys[field.handle] = Joi.object().keys(locales.reduce((keys, locale) => {
				keys[locale] = validation.required();
				return keys;
			}, {} as Joi.SchemaMap));
		} else {
			keys[field.handle] = transformTypeToValidation(field.type);
		}
		if (field.required) {
			keys[field.handle] = keys[field.handle].required();
		}
		return keys;
	}, {} as { [key: string]: Joi.Schema }));

	function transformTypeToValidation(type: FieldType): Joi.Schema {
		switch (type) {
			case 'string': return Joi.string();
			case 'int': return Joi.number().precision(0);
			case 'float': return Joi.number();
			case 'boolean': return Joi.boolean();
			case 'date':
			case 'datetime': return Joi.date();
			default:
				return createValidator(type, locales);
		}
	}
}