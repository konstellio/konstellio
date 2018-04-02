import { Driver, q, Collection, Field, FieldDirection, FieldAs, Function, Binary, Primitive, Value, Comparison, QuerySelect, Query, ComparisonIn, BinaryExpression, replaceField } from "@konstellio/db";
import { Schema, Field as SchemaField, FieldRelation } from "./schema";
import { PluginInitContext } from "./plugin";
import ObjectID from "bson-objectid"
import * as Dataloader from "dataloader";
import { isArray } from "util";

export async function getRecords(context: PluginInitContext, schemas: Schema[], locales: string[]): Promise<Map<string, Record>> {
	const models = new Map<string, Record>();

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];
		if (schema.handle !== 'Relation') {
			models.set(schema.handle, new Record(context.database, schema, locales, models));
		}
	}

	return models;
}

export type RecordType = { [field: string]: undefined | Primitive | Primitive[] };
export type RecordInputType = { [field: string]: undefined | Primitive | Primitive[] | ({ [locale: string]: undefined | Primitive | Primitive[] }) };

const relationCollection = q.collection('Relation');
const fieldId = q.field('id');

export class Record<I extends RecordInputType = any, O extends RecordType = { id: string, [param: string]: any }> {
	
	private readonly collection: Collection;
	private readonly loader: Dataloader<{ id: string, fields?: (string | Field)[] }, O | undefined>;
	private readonly renameMap: Map<string, Map<Field, Field>>;
	private readonly replaceAllMap: Map<string, Map<Field, Field>>;
	private readonly replaceFieldMap: Map<string, Map<Field, Field>>;
	private readonly replaceRelationMap: Map<string, Map<Field, Field>>;
	private readonly replaceSortMap: Map<string, Map<Field, Field>>;
	private readonly allFields: Field[];
	private readonly allRelations: Field[];

	public readonly defaults: I;

	constructor(
		protected readonly database: Driver,
		protected readonly schema: Schema,
		protected readonly locales: string[],
		protected readonly models: Map<string, Record>
	) {
		this.collection = q.collection(schema.handle);

		const defaultLocales = locales.reduce((locales, locale) => { locales[locale] = undefined; return locales; }, {});

		this.defaults = schema.fields.reduce((defaults, field) => {
			if (field.handle !== 'id') {
				defaults[field.handle] = field.localized === true ? defaultLocales : undefined;
			}
			return defaults;
		}, {} as I);

		this.allFields = schema.fields.filter(field => field.type !== 'relation').map(field => q.field(field.handle));
		this.allRelations = schema.fields.filter(field => field.type === 'relation').map(field => q.field(field.handle));

		this.renameMap = new Map<string, Map<Field, Field>>();
		this.replaceAllMap = new Map<string, Map<Field, Field>>();
		this.replaceFieldMap = new Map<string, Map<Field, Field>>();
		this.replaceRelationMap = new Map<string, Map<Field, Field>>();
		this.replaceSortMap = new Map<string, Map<Field, Field>>();

		locales.forEach(locale => {
			const renMap = new Map<Field, Field>();
			const allMap = new Map<Field, Field>();
			const fldMap = new Map <Field, Field>();
			const relMap = new Map<Field, Field>();
			const sortMap = new Map<Field, Field>();
			this.renameMap.set(locale, renMap);
			this.replaceAllMap.set(locale, allMap);
			this.replaceFieldMap.set(locale, fldMap);
			this.replaceRelationMap.set(locale, relMap);
			this.replaceSortMap.set(locale, sortMap);

			schema.fields.forEach(field => {
				renMap.set(q.field(field.handle), q.field(field.localized === true ? `${field.handle}__${locale}` : field.handle));
				if (field.type === 'relation') {
					const target = field.localized === true ? q.field('target', `rel__${field.handle}__${locale}`) : q.field('target', `rel__${field.handle}`);
					allMap.set(q.field(field.handle), target);
					relMap.set(q.field(field.handle), target);
					sortMap.set(q.field(field.handle), field.localized === true ? q.field('seq', `rel__${field.handle}__${locale}`) : q.field('seq', `rel__${field.handle}`));
				} else {
					const target = field.localized === true ? q.field(`${field.handle}__${locale}`) : q.field(field.handle);
					allMap.set(q.field(field.handle), target);
					fldMap.set(q.field(field.handle), target);
					sortMap.set(q.field(field.handle), target);
				}
			});

		});

		let batchedFields: string[] = [];
		this.loader = new Dataloader(
			async (keys) => {
				const ids = keys.map(key => key.id);
				const uids = ids.filter((id, pos, ids) => ids.indexOf(id) === pos);
				const fields = batchedFields.length > 0 ? batchedFields : undefined;
				batchedFields = [];

				const results = await this.find({
					fields: fields,
					condition: q.in('id', uids)
				});

				return ids.map(id => {
					const res = results.filter(result => result.id === id);
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
		);
	}

	public async findById(
		id: string,
		{ locale, fields }: { locale?: string, fields?: (string | Field)[] }
	): Promise<O> {
		try {
			const result = await this.loader.load({ id, fields });
			if (result) {
				return result;
			}
		} catch (err) {}
		throw new Error(`Could not find ID ${id} in ${this.schema.handle}.`);
	}

	public async findByIds(
		ids: string[],
		{ locale, fields }: { locale?: string, fields?: (string | Field)[] }
	): Promise<O[]> {
		try {
			const results = await this.loader.loadMany(ids.map(id => ({ id, fields })));
			const realResults = results.filter((result): result is O => result !== undefined);
			if (realResults.length === ids.length) {
				return realResults;
			}
		} catch (err) {}
		throw new Error(`Could not find IDs ${ids.join(', ')} in ${this.schema.handle}.`);
	}

	public async findOne(
		options: { locale?: string, fields?: (string | Field | FieldAs)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number }
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
		options: { locale?: string, fields?: (string | Field | FieldAs)[], condition?: BinaryExpression, sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<O[]> {
		return this.aggregate<O>(options);
	}

	public async aggregate<T>(
		options: { locale?: string, fields?: (string | Field | FieldAs)[], condition?: BinaryExpression, group?: (Field | Function)[], sort?: FieldDirection[], offset?: number, limit?: number }
	): Promise<T[]> {
		const fieldsUsed: Field[] = [];

		const fields = (options.fields || this.allFields.concat(this.allRelations)).map<Field | FieldAs>(field => typeof field === 'string' ? q.field(field) : field);

		const select = fields.filter(field => {
			if (field instanceof Field) {
				return this.allRelations.find(rel => rel.equal(field)) === undefined;
			}
			else if (field.field instanceof Field) {
				return this.allRelations.find(rel => rel.equal(field.field as Field)) === undefined;
			}
			return true;
		});
		const renamedSelect: (Field | FieldAs)[] = options.locale
			? replaceField(select, this.replaceFieldMap.get(options.locale)!, fieldsUsed)
			: select;

		const where = options.condition ? (options.condition instanceof Comparison ? q.and(options.condition) : options.condition) : undefined;
		const renamedWhere: Binary | undefined = options.locale
			? replaceField(where, this.replaceAllMap.get(options.locale)!, fieldsUsed)
			: where;

		const renamedGroup: (Field | Function)[]  = options.locale && options.group
			? replaceField(options.group, this.replaceAllMap.get(options.locale)!, fieldsUsed)
			: options.group;

		const renamedSort: FieldDirection[] = options.locale && options.sort
			? replaceField(options.sort, this.replaceSortMap.get(options.locale)!, fieldsUsed)
			: options.sort;

		const relationsUsed = fieldsUsed.filter(field => this.allRelations.find(rel => rel.equal(field) === true));

		let query = q.aggregate(...renamedSelect).from(this.collection).range({ offset: options.offset, limit: options.limit });
		if (renamedWhere) {
			query = query.where(renamedWhere);
		}
		if (renamedGroup) {
			query = query.group(...renamedGroup);
		}
		if (renamedSort) {
			query = query.sort(...renamedSort);
		}

		if (relationsUsed.length > 0) {
			relationsUsed.forEach(relation => {
				const renamedRel: Field = options.locale
					? replaceField(relation, this.renameMap.get(options.locale)!)
					: relation;
				
				const def = this.schema.fields.find(field => field.handle === relation.name);
				const field = renamedRel.name;
				const alias = `rel__${field}`;
				const collection = this.schema.handle;
				
				query = query.join(
					alias,
					q.select('collection', 'field', 'source', 'target', 'seq').from(relationCollection).where(q.and(q.eq('collection', collection), q.eq('field', field))),
					q.eq(q.field('source', alias), q.field('id'))
				);
			});

			const renamedId = renamedSelect.find(field => field instanceof Field ? field.equal(fieldId) : (field.field instanceof Field ? field.field.equal(fieldId) : false));
			if (renamedId === undefined) {
				query = query.select(...(query.fields ? query.fields.push(fieldId).toArray() : [fieldId]));
			}
			debugger;
		}

		const result = await this.database.execute<T>(query);
		
		const relationMap = new Map(fields.reduce<[Field, string][]>((fields: [Field, string][], field) => {
			const map = getNestedFields(field)
				.map(([field, alias]) => [field, alias instanceof Field ? alias.name : alias.alias] as [Field, string])
				.filter(([field, alias]) => this.allRelations.find(rel => rel.equal(field)));
			
			fields.push(...map);
			return fields;
		}, []));
		if (relationMap) {
			await this.fetchRelations(relationMap, result.results, options.locale);
		}

		return result.results.map(result => this.getOutputData(
			result,
			options.locale,
			fields
		));
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

	private getOutputData<T>(data: any, locale: string | undefined, allowedFields: (Field | FieldAs)[]): T {
		if (locale === undefined) {
			return data as T;
		}

		return Object.keys(data).reduce((out, key) => {
			const val = data[key];
			// TODO deals with Field inside of args of Function
			const allowed = allowedFields.find(field => field instanceof Field ? field.name === key : field.alias === key);

			if (allowed) {
				out[key] = val;
			}

			// Might be localized ?
			else {
				const def = this.schema.fields.find(field => field.localized === true ? `${field.handle}__${locale}` === key : field.handle === key);

				// Found the field definition
				if (def) {
					// TODO deals with Field inside of args of Function
					const allowed = allowedFields.find(field => field instanceof Field ? field.name === def.handle : field.alias === def.handle);
					if (allowed) {
						out[def.handle] = val;
					}
				}
			}

			return out;
		}, {} as T);
	}

	private async fetchRelations(relationMap: Map<Field, string>, sources: any[], locale?: string): Promise<void> {
		const sourceIds = sources.map<string>(source => source.id);
		const relations = Array.from(relationMap.keys());
		const renamedRelations: Field[] = locale
			? replaceField(relations, this.renameMap.get(locale)!)
			: relations;


		const fields = renamedRelations.map(relation => relation.name);
		if (fields.length > 0) {
			const query = q
				.select('source', 'target', 'field')
				.from(relationCollection)
				.where(q.and(
					q.in('source', sourceIds),
					q.eq('collection', this.schema.handle),
					q.in('field', fields)
				))
				.sort(q.sort('seq', 'asc'));
			
			const result = await this.database.execute<{ source: string, target: string, field: string }>(query);

			sources.forEach(source => {
				renamedRelations.forEach((relation, idx) => {
					const ids = result.results.reduce((ids, row) => {
						if (row.source === source.id && row.field === relation.name) {
							ids.push(row.target);
						}
						return ids;
					}, [] as string[]);

					// TODO find out what is the alias of this relation because getOutputData will discard it
					const originalRel = relations[idx];
					const fieldAs = relationMap.get(originalRel);
					source[fieldAs || relation.name] = ids;
				});
			});
		}
	}
}

function getNestedFields(field: any, root?: Field | FieldAs): [Field, Field | FieldAs][] {
	if (field instanceof Field) {
		return [[field, root || field]];
	}
	else if (field instanceof FieldDirection) {
		if (root === undefined) {
			throw new Error(`Unexpected FieldDirection as Field.`);
		} else {
			return getNestedFields(field.field, root || field);
		}
	}
	else if (field instanceof FieldAs) {
		return getNestedFields(field.field, root || field);
	}
	else if (field instanceof Function) {
		if (root === undefined) {
			throw new Error(`Unexpected Function as Field.`);
		} else {
			return field.args.reduce((fields, field) => {
				if (field instanceof Field || field instanceof Function) {
					fields!.push(...getNestedFields(field, root || field));
				}
				return fields!;
			}, [] as [Field, Field | FieldAs][]);
		}
	}
	return [];
}