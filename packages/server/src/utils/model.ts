import { Driver, q, Collection, Bitwise, SortableField, CalcField, FieldExpression, ValueExpression, Comparison, SelectQuery, Expression, Query } from "@konstellio/db";
import { Schema } from "./schema";
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
export type ModelInputType = { [field: string]: undefined | ValueExpression | ValueExpression[] | { [locale: string]: undefined | ValueExpression | ValueExpression[] } };

export type WithID<O> = {[K in keyof O]: O[K]} & { id: string };

export class Model<O extends ModelType = {}, I extends ModelInputType = {}> {
	
	private readonly collection: Collection;
	private readonly loader: Dataloader<string, WithID<O> | undefined>;

	constructor(
		protected readonly database: Driver,
		protected readonly schema: Schema,
		protected readonly locales: string[],
		protected readonly models: Map<string, Model>
	) {
		this.collection = q.collection(schema.handle);
		this.loader = new Dataloader<string, WithID<O> | undefined>(
			async (keys) => {
				// TODO somehow accumulate fields to only fetch fields that are commons across `keys`
				const query = q.select().from(this.collection).in('id', keys);
				const result = await this.database.execute<WithID<O>>(query);
				
				return keys.map(id => {
					const res = result.results.filter(result => result.id === id);
					return res.length === 1 ? res[0] : undefined;
				});
			}
		)
	}

	async findById(
		id: string,
		options?: {
			fields?: string[]
			locale?: string
		}
	): Promise<WithID<O>> {
		try {
			const result = await this.loader.load(id);
			if (result) {
				return this.reduceOutput<WithID<O>>(
					result,
					options && options.locale,
					options && options.fields && ['id'].concat(options.fields.filter(key => key !== 'id'))
				) as WithID<O>;
			}
		} catch (err) { }
		throw new Error(`Could not find ID ${id} in ${this.schema.handle}.`);
	}

	async findByIds(
		ids: string[],
		options?: {
			fields?: FieldExpression[]
			locale?: string
		}
	): Promise<WithID<O>[]> {
		// TODO localize fields

		try {
			const results = await this.loader.loadMany(ids);
			const realResults = results.filter((result): result is WithID<O> => result !== undefined);
			if (realResults.length === ids.length) {
				return realResults.map((result: WithID<O>) => this.reduceOutput<WithID<O>>(
					result,
					options && options.locale,
					options && options.fields && (['id'] as FieldExpression[]).concat(options.fields.filter(key => typeof key === 'string' ? key !== 'id' : key.name !== 'id')))
				) as WithID<O>[];
			}
		} catch (err) {}
		throw new Error(`Could not find IDs ${ids.join(', ')} in ${this.schema.handle}.`);
	}

	async findOne(options?: {
		locale?: string
		fields?: FieldExpression[]
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
	}): Promise<WithID<O>> {
		// TODO localize fields, condition, sort

		let query = q.select().from(this.collection).limit(1);

		if (options) {
			if (options.fields) {
				query = query.select(...(['id'] as FieldExpression[]).concat(options.fields.filter(key => typeof key === 'string' ? key !== 'id' : key.name !== 'id')));
			}
			if (options.condition) {
				query = query.where(options.condition instanceof Bitwise ? options.condition : q.and(options.condition));
			}
			if (options.sort) {
				query = query.sort(...options.sort);
			}
			if (typeof options.offset === 'number') {
				query = query.offset(options.offset);
			}
		}

		const result = await this.database.execute<WithID<O>>(query);
		if (result.results.length === 0) {
			throw new Error(`Could not find anything matching query in ${this.schema.handle}.`);
		}

		return this.reduceOutput<WithID<O>>(result.results[0], options && options.locale);
	}

	async find(options?: {
		locale?: string
		fields?: FieldExpression[]
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
		limit?: number
	}): Promise<WithID<O>[]> {
		return this.select(options);
	}

	async select(options?: {
		locale?: string
		fields?: FieldExpression[]
		joins?: { [alias: string]: { query: SelectQuery, on: Expression } }
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
		limit?: number
	}): Promise<WithID<O>[]> {
		// TODO localize fields, condition, sort

		let query = q.select().from(this.collection);

		if (options) {
			if (options.fields) {
				query = query.select(...(['id'] as FieldExpression[]).concat(options.fields.filter(key => typeof key === 'string' ? key !== 'id' : key.name !== 'id')));
			}
			if (options.joins) {
				Object.keys(options.joins).forEach(alias => {
					const { query: select, on } = options.joins![alias];
					query = query.join(alias, select, on);
				});
			}
			if (options.condition) {
				query = query.where(options.condition instanceof Bitwise ? options.condition : q.and(options.condition));
			}
			if (options.sort) {
				query = query.sort(...options.sort);
			}
			if (typeof options.offset === 'number') {
				query = query.offset(options.offset);
			}
			if (typeof options.limit === 'number') {
				query = query.limit(options.limit);
			}
		}

		const result = await this.database.execute<WithID<O>>(query);

		return result.results.map(result => this.reduceOutput<WithID<O>>(result, options && options.locale));
	}

	async create(data: I): Promise<string> {
		const id = ObjectID.generate();
		const [obj, relations] = this.reduceInput<I>(data);
		const objID = Object.assign({}, obj, { id });
		
		
		try {
			await this.database.execute(q.insert(this.collection.name, this.collection.namespace).object(objID));

			await this.database.execute(q.delete('Relation').eq('source', id));

			let insert = q.insert('Relation');
			relations.forEach((targetIds, handle) => {
				targetIds.forEach((targetId, idx) => {
					insert = insert.object({
						id: ObjectID.generate(),
						collection: this.schema.handle,
						field: handle,
						source: id,
						target: targetId,
						seq: idx
					});
				});
			});
			
			await this.database.execute(insert);
		} catch (err) {
			throw err;
		}

		return id;
	}

	async update(data: WithID<I>): Promise<string> {
		if (('id' in data) === false) {
			throw new Error(`Could not retrieve property id of data.`);
		}

		// const { id, ...obj } = this.reduceInput<any>(data);

		// const query = q.update(this.collection.name, this.collection.namespace).fields(data).eq('id', id);
		// const result = await this.database.execute(query);

		// return id;
		throw new Error(`Model.update not implemented.`);
	}

	async delete(...ids: string[]): Promise<boolean> {
		const result = await this.database.execute(q.delete(this.collection.name, this.collection.namespace).in('id', ids));
		if (result.acknowledge) {
			await this.database.execute(q.delete('Relation').in('source', ids));
			ids.forEach(id => this.loader.clear(id));
			return true;
		}
		return false;
	}

	async relation<O>(
		id: string,
		handle: string,
		options?: {
			locale?: string
			fields?: FieldExpression[]
			condition?: Bitwise | Comparison
			offset?: number
			limit?: number
		}
	): Promise<WithID<O>[]> {
		const field = this.schema.fields.find(field => field.handle === handle && field.field === 'relation');
		if (field && this.models.has(field.type)) {
			const model = this.models.get(field.type)!;

			if (options && options.locale) {
				handle = this.localizeFields([handle], options.locale)[0] as string;
			}

			// const query = q.select('target').from('Relation').where(q.and(q.eq('collection', this.schema.handle), q.eq('field', handle), q.eq('source', id))).sort('seq', 'asc');
			// const targetIds = await this.database.execute<{ target: string }>(query);
			// const results = await model.findByIds(
			// 	targetIds.results.map<string>(result => result.target),
			// 	{
			// 		fields: options && options.fields,
			// 		locale: options && options.locale
			// 	}
			// );
			// return results as WithID<O>[];

			const results = await model.select({
				fields: options && options.fields,
				joins: {
					relation: {
						query: q.select('collection', 'field', 'source', 'target', 'seq').from('Relation').where(q.and(q.eq('collection', this.schema.handle), q.eq('field', handle), q.eq('source', id))),
						on: q.eq(q.field('target', 'relation'), q.field('id'))
					}
				},
				condition: options && options.condition,
				sort: [q.sort(q.field('seq', 'relation'), 'asc')],
				offset: options && options.offset,
				limit: options && options.limit
			});
			return results.map(result => this.reduceOutput<WithID<O>>(result as WithID<O>, options && options.locale));
		}
		throw new Error(`Relation ${handle} is not defined in ${this.schema.handle}.`);
	}

	private localizeFields(fields: FieldExpression[], locale: string): FieldExpression[] {
		const localized: FieldExpression[] = [];

		fields.forEach(field => {
			const handle = typeof field === 'string' ? field : field.name;
			const schemaField = this.schema.fields.find(f => f.handle === handle);
			if (schemaField) {
				if (schemaField.localized === true) {
					localized.push(typeof field === 'string' ? `${field}__${locale}` : field.rename(`${field}__${locale}`));
				} else {
					localized.push(field);
				}
			}
		});

		return localized;
	}

	private reduceInput<I>(data: any): [I, Map<string, string[]>] {
		const relations = new Map<string, string[]>();

		const obj = Object.keys(data).reduce((obj, key) => {
			const val = data[key];

			const field = this.schema.fields.find(field => field.handle === key);
			if (field) {

				if (field.localized !== true) {
					if (field.field === 'relation') {
						relations.set(key, isArray(val) ? val as string[] : [val as string]);
					} else {
						obj[key] = val;
					}
				}
				else {
					if (field.field === 'relation') {
						this.locales.forEach(code => {
							relations.set(`${key}__${code}`, isArray(val) ? val as string[] : [val as string]);
						});
					} else {
						this.locales.forEach(code => {
							obj[`${key}__${code}`] = typeof val[code] !== undefined ? val[code] : undefined;
						});
					}
				}

			}

			return obj;
		}, {} as I);

		return [obj, relations];
	}

	private reduceOutput<O>(data: O, locale?: string, fields?: FieldExpression[]): O {
		if (locale || fields) {
			const localized = new Map<string, string>(
				locale
					? this.schema.fields.reduce((fields, field) => {
						if (field.localized === true) {
							this.locales.forEach(code => {
								fields.push([`${field.handle}__${code}`, field.handle])
							})
						}
						return fields;
					}, [] as [string, string][])
					: [] as [string, string][]
			);
			
			return Object.keys(data).reduce((filtered, source) => {
				let target: string = source;
				if (localized.has(source)) {
					target = localized.get(source)!;
				}
				if (fields === undefined || fields.indexOf(target) > -1) {
					filtered[target] = data[source];
				}
				return filtered;
			}, {} as O);
		}
		return data;
	}

	private reduceQuery<Q extends Query>(query: Q): Q {
		return query;
	}
}