import { Driver, q, Collection, Field as QueryField, Bitwise, SortableField, CalcField, FieldExpression, ValueExpression, Comparison, SelectQuery, Expression, Query, ComparisonSimple, ComparisonIn } from "@konstellio/db";
import { Schema, Field as SchemaField } from "./schema";
import { PluginInitContext } from "./plugin";
import ObjectID from "bson-objectid"
import * as Dataloader from "dataloader";
import { isArray } from "util";

export async function getModels(context: PluginInitContext, schemas: Schema[], locales: string[]): Promise<Map<string, Model>> {
	const models = new Map<string, Model>();

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];

		models.set(schema.handle, new Model(context.database, schema, locales, models));
	}

	return models;
}

export type ModelType = { [field: string]: undefined | ValueExpression | ValueExpression[] };
export type ModelInputType = { [field: string]: undefined | ValueExpression | ValueExpression[] | ({ [locale: string]: undefined | ValueExpression | ValueExpression[] }) };

type RelationMap = Map<string, string>;
type FieldMap = Map<string, Map<string, string>>;

export class Model<I extends ModelInputType = any, O extends ModelType = { id: string, [param: string]: any }> {
	
	private readonly collection: Collection;
	private readonly loader: Dataloader<string, O>;
	private readonly fields: string[];
	private readonly fieldMaps: FieldMap;
	private readonly relationMaps: RelationMap;

	constructor(
		protected readonly database: Driver,
		protected readonly schema: Schema,
		protected readonly locales: string[],
		protected readonly models: Map<string, Model>
	) {
		this.collection = q.collection(schema.handle);

		this.fields = schema.fields.map(field => field.handle);

		this.fieldMaps = new Map(
			locales.map<[string, Map<string, string>]>(locale => {
				return [
					locale,
					new Map<string, string>(
						schema.fields.map<[string, string]>(field => {
							if (field.localized === true) {
								return [field.handle, `${field.handle}__${locale}`];
							} else {
								return [field.handle, field.handle];
							}
						})
					)
				];
			})
		);

		this.relationMaps = new Map(
			schema.fields.reduce((relations, field) => {
				if (field.type === 'relation' && 'model' in field) {
					relations.push([field.handle, field.model]);
				}
				return relations;
			}, [] as [string, string][])
		);
	}

	async findById(
		id: string,
		{ locale, fields }: { locale?: string, fields: string[] }
	): Promise<O> {
		throw new Error(`Model.findById not implemented.`);
	}

	async findByIds(
		ids: string[],
		{ locale, fields }: { locale?: string, fields?: string[] }
	): Promise<O> {
		throw new Error(`Model.findByIds not implemented.`);
	}

	async findOne(
		options: { locale?: string, fields?: string[], condition?: Bitwise | Comparison, sort?: SortableField[], offset?: number }
	): Promise<O> {
		const results = await this.find({
			...options,
			limit: 1
		});
		if (results.length === 0) {
			throw new Error(`Could not find anything matching query in ${this.schema.handle}.`);
		}
		return results[0];
	}

	async find(
		{ locale, fields, condition, sort, offset, limit }: { locale?: string, fields?: string[], condition?: Bitwise | Comparison, sort?: SortableField[], offset?: number, limit?: number }
	): Promise<O[]> {
		

		const relationUsed = new Map<string, [string, string]>();

		fields = fields || this.fields;

		let query = q.select(...fields.map(key => transformField(key, this.fieldMaps, this.relationMaps, relationUsed, locale,))).from(this.collection);

		if (condition) {
			query = query.where(transformCondition(condition instanceof Bitwise ? condition : q.and(condition), this.fieldMaps, this.relationMaps, relationUsed, locale));
		}
		if (sort) {
			query = query.sort(...transformSorts(sort, this.fieldMaps, this.relationMaps, relationUsed, locale));
		}
		if (typeof offset === 'number') {
			query = query.offset(offset);
		}
		if (typeof limit === 'number') {
			query = query.limit(limit);
		}

		relationUsed.forEach(([handle, alias], model) => {
			query = query.join(
				alias,
				q.select('collection', 'field', 'source', 'target', 'seq').from('Relation').where(q.and(q.eq('collection', this.schema.handle), q.eq('field', handle))),
				q.eq(q.field('source', alias), q.field('id'))
			);
		});

		const result = await this.database.execute<O>(query);

		// TODO fetch relationUsed by results

		return result.results.map(result => filterResults<O>(result, fields!, this.fieldMaps, locale));
	}

	validate(data: any, errors = [] as Error[]): data is I {
		if (typeof data !== 'object') {
			errors.push(new Error(`Expected data to be an object.`));
			return false;
		}

		const fields = this.schema.fields;
		for (let i = 0, l = fields.length; i < l; ++i) {
			const field = fields[i];
			const value = data[field.handle];

			validateField(value, field, this.locales, errors);
			// if (validateField(value, field, this.locales, errors) === false) {
			// 	return false;
			// }
		}
		return errors.length === 0;
		// return true;
	}

	async create(
		data: I
	): Promise<O> {
		const id = ObjectID.generate();
		const [fields, relations] = flattenData(data, this.fieldMaps, this.relationMaps);
		const input = Object.assign({}, fields, { id });
		
		try {
			await this.database.execute(q.insert(this.collection.name, this.collection.namespace).object(input));
			await this.database.execute(q.delete('Relation').eq('source', id));

			let insert = q.insert('Relation');
			Object.keys(relations).forEach(handle => {
				const targetIds = relations[handle];
				targetIds.forEach((targetId, i) => {
					insert = insert.object({
						id: ObjectID.generate(),
						collection: this.schema.handle,
						field: handle,
						source: id,
						target: targetId,
						seq: i
					});
				})
			})
			await this.database.execute(insert);
		} catch (err) {
			throw err;
		}

		return {} as O;
	}

	async replace(
		data: I
	): Promise<string> {
		throw new Error(`Model.replace not implemented.`);
	}

	async delete(
		ids: string[]
	): Promise<boolean> {
		const result = await this.database.execute(q.delete(this.collection.name, this.collection.namespace).in('id', ids));
		if (result.acknowledge) {
			await this.database.execute(q.delete('Relation').in('source', ids));
			ids.forEach(id => this.loader.clear(id));
			return true;
		}
		return false;
	}
}

function transformField(field: string | QueryField, fieldMaps: FieldMap, relationMaps: RelationMap, relationUsed: Map<string, [string, string]>, locale?: string, inSelect?: boolean): QueryField {
	if (locale === undefined) {
		return typeof field === 'string' ? q.field(field) : field;
	}
	if (fieldMaps.has(locale) === false) {
		throw new Error(`Locale ${locale} not defined.`);
	}
	const handle = typeof field === 'string' ? field : field.name;
	const target = fieldMaps.get(locale)!.get(handle)!;
	if (relationMaps.has(handle)) {
		const model = relationMaps.get(handle)!;
		const alias = `relation_${relationMaps.get(handle)!}`;
		relationUsed.set(model, [target, alias]);
		return q.field('target', alias);
	}
	return typeof field === 'string' ? q.field(target) : field.rename(target);
}

function transformSorts(sorts: SortableField[], fieldMaps: FieldMap, relationMaps: RelationMap, relationUsed: Map<string, [string, string]>, locale?: string): SortableField[] {
	if (locale === undefined) {
		return sorts;
	}
	else if (fieldMaps.has(locale) === false) {
		throw new Error(`Locale ${locale} not defined.`);
	}

	const localized: SortableField[] = [];

	sorts.forEach(field => {
		if (typeof field === 'string') {
			localized.push(q.sort(transformField(field, fieldMaps, relationMaps, relationUsed, locale), 'asc'));
		} else {
			const localeField = transformField(field.field, fieldMaps, relationMaps, relationUsed, locale);
			if (field.field === localeField) {
				localized.push(field);
			} else {
				localized.push(q.sort(localeField, field.direction));
			}
		}
	});

	return localized;
}

function transformCondition(node: Bitwise, fieldMaps: FieldMap, relationMaps: RelationMap, relationUsed: Map<string, [string, string]>, locale?: string): Bitwise {
	if (locale === undefined) {
		return node;
	}
	else if (fieldMaps.has(locale) === false) {
		throw new Error(`Locale ${locale} not defined.`);
	}

	if (node.operands === undefined) {
		return node;
	}

	const localizedFields = fieldMaps.get(locale)!;

	let simplified = node;
	node.operands.forEach(operand => {
		if (operand instanceof Comparison) {
			const handle = typeof operand.field === 'string' ? operand.field : operand.field.name;
			if (localizedFields.has(handle)) {
				const localeField = transformField(operand.field, fieldMaps, relationMaps, relationUsed, locale);
				if (operand instanceof ComparisonIn) {
					simplified = simplified.replace(operand, new ComparisonIn(localeField, operand.values));
				}
				else if (operand instanceof ComparisonSimple) {
					let value = operand.value;
					if (value && value instanceof QueryField) {
						if (localizedFields.has(value.name)) {
							const localeValue = transformField(value.name, fieldMaps, relationMaps, relationUsed, locale);
							simplified = simplified.replace(operand, new ComparisonSimple(localeValue, operand.operator, value));
						}
					}
					else if (value) {
						simplified = simplified.replace(operand, new ComparisonSimple(localeField, operand.operator, value));
					}
				}
				else {
					throw new Error(`Unsupported Comparison ${operand}.`);
				}
			}
		}
		else if (operand instanceof Bitwise) {
			simplified = simplified.replace(operand, transformCondition(operand, fieldMaps, relationMaps, relationUsed, locale));
		}
	});

	return simplified;
}

function validateField(value: any, field: SchemaField, locales: string[], errors: Error[], locale = false): boolean {
	// Localized
	if (field.localized === true && locale === false) {
		if (typeof value !== 'object') {
			errors.push(new Error(`Expected ${field.handle} to be an object.`));
			return false;
		}
		return locales.reduce((valid, locale) => {
			if (typeof value[locale] === 'undefined') {
				errors.push(new Error(`Expected ${field.handle}.${locale} to be defined.`));
				return false;
			}
			return valid && validateField(value[locale], field, locales, errors, true);
		}, true);
	}

	// Required
	if (field.required === true && !value) {
		errors.push(new Error(`Expected ${field.handle} to be non-null.`));
		return false;
	}

	// Relation !== string[]
	if (field.type === 'relation' && (!isArray(value) || value.find(v => typeof v !== 'string') !== undefined)) {
		errors.push(new Error(`Expected ${field.handle} to be an array of string.`));
		return false;
	}
	// Text, Html !== string
	else if ((field.type === 'text' || field.type === 'html') && typeof value !== 'string') {
		errors.push(new Error(`Expected ${field.handle} to be a string.`));
		return false;
	}
	// Date, DateTime !== Date
	else if ((field.type === 'date' || field.type === 'datetime') && (value instanceof Date) === false) {
		errors.push(new Error(`Expected ${field.handle} to be an instance of Date.`));
		return false;
	}
	// Int, Float is a Number
	else if ((field.type === 'int' || field.type === 'float') && isNaN(value) === true) {
		errors.push(new Error(`Expected ${field.handle} to be a number.`));
		return false;
	}
	// Bool is a boolean
	else if ((field.type === 'bool' || field.type === 'boolean') && typeof value !== 'boolean') {
		errors.push(new Error(`Expected ${field.handle} to be a boolean.`));
		return false;
	}

	return true;
}

function flattenData(data: any, fieldMaps: FieldMap, relationMaps: RelationMap): [{ [field: string]: ValueExpression }, { [relation: string]: string[] }] {
	const fields: { [field: string]: ValueExpression } = {};
	const relations: { [relation: string]: string[] } = {};
	const locales = Array.from(fieldMaps.keys());
	const defaultLocale = locales[0];
	const defaultFields = fieldMaps.get(defaultLocale)!;

	Object.keys(data).forEach(key => {
		const val = data[key];

		if (defaultFields.has(key) === true) {
			const isRelation = relationMaps.has(key);
			const isLocalized = defaultFields.get(key) !== key;

			if (isRelation) {
				if (isLocalized) {
					locales.forEach(locale => {
						relations[fieldMaps.get(locale)!.get(key)!] = val[locale];
					});
				} else {
					relations[key] = val;
				}
			} else {
				if (isLocalized) {
					locales.forEach(locale => {
						fields[fieldMaps.get(locale)!.get(key)!] = val[locale];
					});
				} else {
					fields[key] = val;
				}
			}
		}
	});

	return [fields, relations];
}

function filterResults<O>(data: any, fields: string[], fieldMaps: FieldMap, locale?: string): O {
	const locales = Array.from(fieldMaps.keys());
	const defaultLocale = locales[0];

	locale = locale || defaultLocale;
	
	const localizedFields = fieldMaps.get(locale)!;

	const out = {} as O;

	localizedFields.forEach((source, target) => {
		if (fields.indexOf(target) > -1) {
			out[target] = data[source];
		}
	});

	return out;
}