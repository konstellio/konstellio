import { Driver, q, Collection, Field as QueryField, Binary, FieldDirection, Function, Primitive, Value, Comparison, QuerySelect, Query, ComparisonIn, BinaryExpression, Field, renameField } from "@konstellio/db";
import { Schema, Field as SchemaField, FieldRelation } from "./schema";
import { PluginInitContext } from "./plugin";
import ObjectID from "bson-objectid"
import * as Dataloader from "dataloader";
import { isArray } from "util";

export async function getModels(context: PluginInitContext, schemas: Schema[], locales: string[]): Promise<Map<string, Model>> {
	const models = new Map<string, Model>();

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];
		if (schema.handle !== 'Relation') {
			models.set(schema.handle, new Model(context.database, schema, locales, models));
		}
	}

	return models;
}

export type ModelType = { [field: string]: undefined | Primitive | Primitive[] };
export type ModelInputType = { [field: string]: undefined | Primitive | Primitive[] | ({ [locale: string]: undefined | Primitive | Primitive[] }) };

export type ModelField = string | QueryField | FieldDirection;

const relationCollection = q.collection('Relation');

export class Model<I extends ModelInputType = any, O extends ModelType = { id: string, [param: string]: any }> {
	
	private readonly collection: Collection;
	private readonly loader: Dataloader<{ id: string, fields?: string[] }, O | undefined>;
	private readonly renameMap: Map<string, Map<QueryField, QueryField>>;
	private readonly allFields: string[];
	private readonly allRelations: string[];

	public readonly defaults: I;

	constructor(
		protected readonly database: Driver,
		protected readonly schema: Schema,
		protected readonly locales: string[],
		protected readonly models: Map<string, Model>
	) {
		this.collection = q.collection(schema.handle);

		const defaultLocales = locales.reduce((locales, locale) => { locales[locale] = undefined; return locales; }, {});

		this.defaults = schema.fields.reduce((defaults, field) => {
			if (field.handle !== 'id') {
				defaults[field.handle] = field.localized === true ? defaultLocales : undefined;
			}
			return defaults;
		}, {} as I);

		this.allFields = schema.fields.map(field => field.handle);
		this.allRelations = schema.fields.filter(field => field.type === 'relation').map(field => field.handle);

		this.renameMap = new Map<string, Map<QueryField, QueryField>>(locales.reduce((map, locale) => {
			map.push([
				locale,
				new Map<QueryField, QueryField>(schema.fields.reduce((map, field) => {
					if (field.type === 'relation') {
						map.push([
							q.field(field.handle),
							field.localized === true ? q.field('target', `rel__${field.handle}__${locale}`) : q.field('target', `rel__${field.handle}`)
						]);
					} else {
						map.push([
							q.field(field.handle),
							field.localized === true ? q.field(`${field.handle}__${locale}`) : q.field(field.handle)
						]);
					}
					return map;
				}, [] as [QueryField, QueryField][]))
			])
			return map;
		}, [] as [string, Map<QueryField, QueryField>][]));

		let batchedFields: string[] = [];
		this.loader = new Dataloader(
			async (keys) => {
				const [fields, relations] = this.getFieldsRelations(batchedFields);
				batchedFields = [];

				const renamedFields = this.locales.reduce((renamedFields, locale) => {
					renamedFields.push(...(<string[]>this.getRenamedFields(fields, locale)))
					return renamedFields;
				}, [] as string[]).filter((field, pos, fields) => fields.indexOf(field) === pos).concat(['id']);

				const ids = keys.map(key => key.id);
				const uids = ids.filter((id, pos, ids) => ids.indexOf(id) === pos);
				const query = q.select(...renamedFields).from(this.collection).where(q.in('id', uids));
				const result = await this.database.execute<O>(query);

				if (relations.length > 0) {
					await this.fetchRelations(relations, uids, result.results);
				}

				return ids.map(id => {
					const res = result.results.filter(result => result.id === id);
					return res.length === 1 ? res[0] : undefined;
				});
			}, {
				cache: false,
				cacheKeyFn(key: { id: string, fields?: string[] }) {
					const { id, fields } = key;
					if (fields) {
						batchedFields.push(...fields);
					}
					return id;
				}
			}
		)
	}

	public async findById(
		id: string,
		{ locale, fields }: { locale?: string, fields?: (string | Field)[] }
	): Promise<O> {
		const selectFields = fields ? fields.map<string>(field => typeof field === 'string' ? field : field.name) : this.allFields;
		try {
			const result = await this.loader.load({ id, fields: selectFields });
			if (result) {
				return this.getOutputData(
					result,
					locale,
					selectFields
				);
			}
		} catch (err) {}
		throw new Error(`Could not find ID ${id} in ${this.schema.handle}.`);
	}

	public async findByIds(
		ids: string[],
		{ locale, fields }: { locale?: string, fields?: (string | Field)[] }
	): Promise<O[]> {
		const selectFields = fields ? fields.map<string>(field => typeof field === 'string' ? field : field.name) : this.allFields;
		try {
			const results = await this.loader.loadMany(ids.map(id => ({ id, fields: selectFields })));
			const realResults = results.filter((result): result is O => result !== undefined);
			if (realResults.length === ids.length) {
				return realResults.map(result => this.getOutputData(
					result,
					locale,
					selectFields
				));
			}
		} catch (err) {}
		throw new Error(`Could not find IDs ${ids.join(', ')} in ${this.schema.handle}.`);
	}

	public async findOne(
		options: { locale?: string, fields?: (string | Field)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number }
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

	public async find(
		{ locale, fields, condition, sort, offset, limit }: { locale?: string, fields?: (string | Field)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<O[]> {

		const [flds, rels] = this.getFieldsRelations(fields ? fields : this.allFields);
		const renamedFlds = this.getRenamedFields(flds, locale) as (string | Field)[];
		const renamedRels = this.getRenamedFields(rels, locale) as (string | Field)[];

		let query = q.select(...renamedFlds).from(this.collection).range({ offset, limit });
		
		let renamedCondition = condition;
		let renamedSort = sort;
		if (locale && this.renameMap.has(locale)) {
			const map = this.renameMap.get(locale)!;
			if (condition) {
				if (condition instanceof Binary) {
					renamedCondition = renameField(condition, map);
				} else {
					renamedCondition = renameField(condition, map);
				}
			}

			if (sort) {
				sort = renameField(sort, map);
			}
		}

		if (condition && renamedCondition) {
			const binaryCond = condition instanceof Binary ? condition : q.and(condition);
			binaryCond.visit(expr => {
				if (expr instanceof Comparison) {
					if (expr.field instanceof QueryField) {
						if (expr.field.alias === undefined) {
							rels.push(expr.field.name);
						}
					} else {
						// rels.push(...getFields(expr.args.toArray())) // TODO intersect with this.allRelations
					}
				}
				return expr;
			}, true);

			query = query.where(renamedCondition);
		}
		if (sort && renamedSort) {
			const [sortFlds, sortRels] = this.getFieldsRelations(sort.map(field => field.field).filter(field => field.alias === undefined));
			rels.push(...sortRels);

			query = query.sort(...renamedSort);
		}

		debugger;

		return [] as O[];
	}

	public async aggregate(
		{ locale, fields, condition, group, sort, offset, limit }: { locale?: string, fields?: (string | Field | Function)[], condition?: BinaryExpression, group?: (string | Field)[], sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<O[]> {
		throw new Error(`Model.aggregate not implemented.`);
	}

	public async create(
		data: I
	): Promise<string> {
		const id = ObjectID.generate();
		const [fields, relations] = this.getFlattedData(data);
		const input = { ...fields, id };
		const collection = this.schema.handle;

		try {
			await this.database.execute(q.insert(this.collection).add(input));
			
			let insert = q.insert(relationCollection);
			Object.keys(relations).forEach(handle => {
				const targetIds = relations[handle];
				targetIds.forEach((targetId, i) => {
					insert = insert.add({
						id: ObjectID.generate(),
						collection: collection,
						field: handle,
						source: id,
						target: targetId,
						seq: i
					});
				})
			});
			await this.database.execute(insert);
		} catch (err) {
			throw err;
		}

		return id;
	}

	public async replace(
		data: I
	): Promise<boolean> {
		if (typeof data['id'] === 'undefined') {
			throw new Error(`Expected id to be defined.`);
		}
		const [{ id, ...input }, relations] = this.getFlattedData(data);
		const collection = this.schema.handle;

		try {
			await this.database.execute(q.update(this.collection).set(input).where(q.eq('id', id)));
			await this.database.execute(q.delete(relationCollection).where(q.eq('source', id)));

			let insert = q.insert(relationCollection);
			Object.keys(relations).forEach(handle => {
				const targetIds = relations[handle];
				targetIds.forEach((targetId, i) => {
					insert = insert.add({
						id: ObjectID.generate(),
						collection: collection,
						field: handle,
						source: id,
						target: targetId,
						seq: i
					});
				})
			});
			await this.database.execute(insert);
		} catch (err) {
			throw err;
		}

		return true;
	}

	public async delete(
		ids: string[]
	): Promise<boolean> {
		const result = await this.database.execute(q.delete(this.collection).where(q.in('id', ids)));
		if (result.acknowledge) {
			await this.database.execute(q.delete('Relation').where(q.in('source', ids)));
			ids.forEach(id => this.loader.clear({ id }));
			return true;
		}
		return false;
	}

	public validate(data: any, errors: Error[] = []): data is I {
		if (typeof data !== 'object') {
			errors.push(new Error(`Expected data to be an object.`));
			return false;
		}

		const fields = this.schema.fields;
		for (let i = 0, l = fields.length; i < l; ++i) {
			const field = fields[i];
			if (field.handle !== 'id') {
				const value = data[field.handle];

				this.validateField(value, field, errors);
				// if (this.validateField(value, field, errors) === false) {
				// 	return false;
				// }
			}
		}
		return errors.length === 0;
		// return true;
	}

	private validateField(value: any, field: SchemaField, errors: Error[], locale = false): boolean {
		// Localized
		if (field.localized === true && locale === false) {
			if (typeof value !== 'object') {
				errors.push(new Error(`Expected ${field.handle} to be an object.`));
				return false;
			}
			return this.locales.reduce((valid, locale) => {
				if (typeof value[locale] === 'undefined') {
					errors.push(new Error(`Expected ${field.handle}.${locale} to be defined.`));
					return false;
				}
				return valid && this.validateField(value[locale], field, errors, true);
			}, true);
		}

		// Required
		if (field.required === true && !value) {
			errors.push(new Error(`Expected ${field.handle} to be non-null.`));
			return false;
		}

		// Undefined / Null, but not required
		else if (value === undefined || value === null) {
			return true;
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

	private async fetchRelations(relations: ModelField[], sourceIds: string[], results: O[]): Promise<void> {
		const renamedRelations = this.locales.reduce((renamedFields, locale) => {
			renamedFields.push(...(<string[]>this.getRenamedFields(relations, locale)))
			return renamedFields;
		}, [] as string[]).filter((rel, pos, rels) => rels.indexOf(rel) === pos);

		const query = q.select('source', 'target', 'field').from(relationCollection).where(q.and(q.in('source', sourceIds), q.eq('collection', this.schema.handle), q.in('field', renamedRelations))).sort(q.sort('seq', 'asc'));
		const relResult = await this.database.execute<{ source: string, target: string, field: string }>(query);

		results.forEach(result => {
			renamedRelations.forEach(handle => {
				result[handle] = relResult.results.reduce((ids, rel) => {
					if (rel.source === result.id && rel.field === handle) {
						ids.push(rel.target);
					}
					return ids;
				}, [] as string[]);
			});
		});
	}

	private getFieldsRelations(fields: ModelField[]): [ModelField[], ModelField[]] {
		const flds: ModelField[] = [];
		const rels: ModelField[] = [];

		fields.forEach(field => {
			const handle = typeof field === 'string' ? field : (field instanceof QueryField ? field.name : field.field.name);
			const def = this.schema.fields.find(field => field.handle === handle);
			if (def) {
				if (def.type === 'relation') {
					rels.push(field);
				} else {
					flds.push(field);
				}
			}
		});

		return [flds, rels];
	}

	private getRenamedFields(fields: ModelField[], locale?: string): typeof fields {
		if (locale === undefined) {
			return fields;
		}

		if (this.renameMap.has(locale) === false) {
			throw new Error(`Locale ${locale} not defined in schema.`);
		}

		const map = this.renameMap.get(locale)!;
		return fields.map(field => renameField(field as string, map));
	}

	private getFlattedData(data: I): [({ [field: string]: Primitive }), ({ [relation: string]: string[] })] {
		const fields: { [field: string]: Primitive } = {};
		const relations: { [relation: string]: string[] } = {};

		this.schema.fields.forEach(field => {
			let key = field.handle;
			if (field.localized === true) {
				this.locales.forEach(locale => {
					if (typeof (<any>data)[key] === 'undefined' || typeof (<any>data)[key][locale] === 'undefined') {
						throw new Error(`Expected ${key}.${locale} to be defined.`)
					}

					if (field.type === 'relation') {
						if (isArray((<any>data)[key][locale]) === false) {
							throw new Error(`Expected ${key}.${locale} to be an array.`)
						}
						relations[`${field.handle}__${locale}`] = (<any>data)[key][locale];
					} else {
						fields[`${field.handle}__${locale}`] = (<any>data)[key][locale];
					}
				})
			}
			else if (typeof (<any>data)[key] !== 'undefined') {
				if (field.type === 'relation') {
					if (isArray((<any>data)[key]) === false) {
						throw new Error(`Expected ${key} to be an array.`)
					}
					relations[key] = (<any>data)[key];
				} else {
					fields[key] = (<any>data)[key];
				}
			}
		});

		return [fields, relations];
	}

	private getOutputData(data: any, locale?: string, fields: string[] = []): O {
		if (locale === undefined) {
			return data as O;
		}

		if (this.renameMap.has(locale) === false) {
			throw new Error(`Locale ${locale} not defined in schema.`);
		}

		return this.schema.fields.reduce((out, field) => {
			const key = field.localized === true ? `${field.handle}__${locale}` : field.handle;
			if (fields.indexOf(field.handle) > -1 && typeof data[key] !== 'undefined') {
				out[field.handle] = data[key];
			}
			return out;
		}, {} as O);
	}
}

function getFields(args: Value[]): string[] {
	return args.reduce((fields, arg) => {
		if (arg instanceof QueryField && arg.alias === undefined) {
			fields.push(arg.name);
		}
		else if (arg instanceof Function) {
			fields.push(...this.getFields(arg.args.toArray()));
		}
		return fields;
	}, [] as string[])
}