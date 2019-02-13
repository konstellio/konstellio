import * as Joi from 'joi';

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type Schema = Object | Union;

export interface ObjectBase {
	handle: string;
	fields: Field[];
}

export interface Object extends ObjectBase {
	indexes: Index[];
}

export interface Union {
	handle: string;
	objects: ObjectBase[];
	indexes: Index[];
}

export type FieldType = 'string'
	| 'int'
	| 'float'
	| 'boolean'
	| 'date'
	| 'datetime'
	| ObjectBase;

export interface Field {
	handle: string;
	type: FieldType;
	size?: number;
	required?: boolean;
	relation?: boolean;
	localized?: boolean;
	multiple?: boolean;
	inlined?: boolean;
}

export type IndexType = 'primary'
	| 'unique'
	| 'sparse';

export interface IndexField {
	handle: string;
	direction?: 'asc' | 'desc';
}

export interface Index {
	handle: string;
	type: IndexType;
	fields: IndexField[];
}

export const localizedFieldName = /^(.*)__([a-z]+)$/;

const fieldTypeValidator = Joi.alternatives().try(
	Joi.string().allow('text', 'int', 'float', 'boolean', 'date', 'datetime'),
	Joi.lazy(() => objectBaseValidator)
);

const fieldValidator = Joi.object().keys({
	handle: Joi.string().required().regex(localizedFieldName, { invert: true }),
	type: fieldTypeValidator.required(),
	size: Joi.number().min(1),
	required: Joi.boolean(),
	relation: Joi.boolean(),
	localized: Joi.boolean(),
	multiple: Joi.boolean(),
	inlined: Joi.boolean()
});

const indexTypeValidator = Joi.string().allow('primary', 'unique', 'sparse');

const indexValidator = Joi.object().keys({
	handle: Joi.string().required().regex(localizedFieldName, { invert: true }),
	type: indexTypeValidator.required(),
	fields: Joi.array().items(Joi.object().keys({
		handle: Joi.string().required().regex(localizedFieldName, { invert: true }),
		direction: Joi.string().allow('asc', 'desc')
	})).min(1)
});

const objectBaseValidator = Joi.object().keys({
	handle: Joi.string().required(),
	fields: Joi.array().items(fieldValidator).min(1).required()
});

const objectValidator = objectBaseValidator.keys({
	indexes: Joi.array().items(indexValidator).min(0).required()
});

const unionValidator = Joi.object().keys({
	handle: Joi.string().required(),
	objects: Joi.array().items(objectBaseValidator).min(1).required(),
	indexes: Joi.array().items(indexValidator).min(0).required()
});

const schemaValidator = Joi.alternatives().try(objectValidator, unionValidator).required();

export function isSchema(schema: any): schema is Schema {
	return isObject(schema) || isUnion(schema);
}

export function isObject(schema: any): schema is Object {
	return isObjectBase(schema);
}

export function isObjectBase(schema: any): schema is ObjectBase {
	return typeof schema.fields !== 'undefined';
}

export function isUnion(schema: any): schema is Union {
	return typeof schema.objects !== 'undefined';
}

export function validateSchema(schema: any, errors?: Joi.ValidationErrorItem[]): schema is Schema {
	const result = Joi.validate(schema, schemaValidator);

	if (result.error) {
		if (errors) {
			errors.push(...result.error.details);
		}
		return false;
	}

	let hasErrors = false;
	if (isUnion(schema) && schema.objects.length > 1) {
		const fieldTypes = new Map<string, [FieldType, number | undefined]>();
		for (let a = 0, aa = schema.objects.length; a < aa; ++a) {
			for (let b = 0, bb = schema.objects[a].fields.length; b < bb; ++b) {
				const { handle, type, size } = schema.objects[a].fields[b];
				if (fieldTypes.has(handle)) {
					const [prevType, prevSize] = fieldTypes.get(handle)!;
					if (prevType !== type || prevSize !== size) {
						hasErrors = true;
						if (errors) {
							errors.push({
								message: `"objects.${a}.fields.${b}.handle" is previously defined as type ${prevType}${prevSize ? `(${prevSize})` : ''}`,
								type: 'any.ref',
								path: ['objects', a, 'fields', b, handle]
							} as Joi.ValidationErrorItem);
						}
					}
				} else {
					fieldTypes.set(handle, [type, size]);
				}
			}
		}
	}

	if (isSchema(schema)) {
		const fields = isUnion(schema)
			? schema.objects.reduce((fields, obj) => {
				return [...fields, ...obj.fields.map(field => field.handle)];
			}, [] as string[])
			: schema.fields.map(field => field.handle);
		
		for (let a = 0, aa = schema.indexes.length; a < aa; ++a) {
			for (let b = 0, bb = schema.indexes[a].fields.length; b < bb; ++b) {
				const { handle } = schema.indexes[a].fields[b];
				if (!fields.includes(handle)) {
					hasErrors = true;
					if (errors) {
						errors.push({
							message: `"indexes.${a}.fields.${b}.handle" is not defined as a field`,
							type: 'any.ref',
							path: ['indexes', a, 'fields', b, 'handle']
						} as Joi.ValidationErrorItem);
					}
				}
			}
		}
	}

	return !hasErrors;
}

export function createValidator(schema: ObjectBase | Union, locales: string[]): Joi.Schema {
	return isUnion(schema)
		? Joi.alternatives().try(...schema.objects.map(transformObject))
		: transformObject(schema);
	
	function transformObject(schema: ObjectBase): Joi.Schema {
		return Joi.object().keys(schema.fields.reduce((keys, field) => {
			let validator = field.inlined
				? Joi.string()
				: transformTypeToValidation(field.type);

			if (field.multiple) {
				validator = Joi.array().items(validator).min(0);
			}

			if (field.required) {
				validator = validator.required();
			}
			
			if (field.localized && locales.length) {
				keys[field.handle] = Joi.object().keys(locales.reduce((keys, locale) => {
					keys[locale] = validator.required();
					return keys;
				}, {} as Joi.SchemaMap));

				if (field.required) {
					keys[field.handle] = keys[field.handle].required();
				}
			} else {
				keys[field.handle] = validator;
			}

			return keys;
		}, {} as { [key: string]: Joi.Schema }));
	}

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