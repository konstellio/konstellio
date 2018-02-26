import { Driver, q, Collection, Bitwise, SortableField, CalcField, FieldExpression, ValueExpression, Comparison, SelectQuery, Expression, Query } from "@konstellio/db";
import { Schema } from "./schema";
import { PluginInitContext } from "./plugin";
import ObjectID from "bson-objectid"
import * as Dataloader from "dataloader";

export async function getModels(context: PluginInitContext, schemas: Schema[], locales: string[]): Promise<Map<string, Model>> {
	const models = new Map<string, Model>();

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];

		models.set(schema.handle, new Model(context.database, schema, locales, models));
	}

	return models;
}

export type ModelType = { [field: string]: undefined | ValueExpression };
export type ModelInputType = { [field: string]: undefined | ValueExpression | { [locale: string]: ValueExpression } };

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
				return this.localizeResult<WithID<O>>(
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
			fields?: string[]
			locale?: string
		}
	): Promise<WithID<O>[]> {
		// TODO localize fields

		try {
			const results = await this.loader.loadMany(ids);
			const realResults = results.filter((result): result is WithID<O> => result !== undefined);
			if (realResults.length === ids.length) {
				return realResults.map((result: WithID<O>) => this.localizeResult<WithID<O>>(
					result,
					options && options.locale,
					options && options.fields && ['id'].concat(options.fields.filter(key => key !== 'id')))
				) as WithID<O>[];
			}
		} catch (err) {}
		throw new Error(`Could not find IDs ${ids.join(', ')} in ${this.schema.handle}.`);
	}

	async findOne(options?: {
		locale?: string
		fields?: string[]
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
	}): Promise<WithID<O>> {
		// TODO localize fields, condition, sort

		let query = q.select().from(this.collection).limit(1);

		if (options) {
			if (options.fields) {
				query = query.select(...['id'].concat(options.fields.filter(key => key !== 'id')));
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

		return this.localizeResult<WithID<O>>(result.results[0], options && options.locale);
	}

	async find(options?: {
		locale?: string
		fields?: string[]
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
		limit?: number
	}): Promise<WithID<O>[]> {
		// TODO localize fields, condition, sort

		let query = q.select().from(this.collection);

		if (options) {
			if (options.fields) {
				query = query.select(...['id'].concat(options.fields.filter(key => key !== 'id')));
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

		return result.results.map(result => this.localizeResult<WithID<O>>(result, options && options.locale));
	}

	async aggregate<O>(options?: {
		locale?: string
		fields?: (string | CalcField)[]
		joins?: { [alias: string]: { query: SelectQuery, on: Expression } }
		condition?: Bitwise | Comparison
		group?: FieldExpression[]
		sort?: SortableField[]
		offset?: number
		limit?: number
	}): Promise<O[]> {
		// TODO localized fields, joins, condition, group, sort and results
		
		throw new Error(`Model.aggregate not implemented yet.`);
	}

	async create(data: I): Promise<string> {
		const id = ObjectID.generate();
		const obj: WithID<I> = Object.assign({}, this.localizeInput<I>(data), { id });
		
		const query = q.insert(this.collection.name, this.collection.namespace).fields(obj);
		const result = await this.database.execute(query);

		return id;
	}

	async update(data: WithID<I>): Promise<string> {
		if (('id' in data) === false) {
			throw new Error(`Could not retrieve property id of data.`);
		}

		const { id, ...obj } = this.localizeInput<any>(data);

		const query = q.update(this.collection.name, this.collection.namespace).fields(data);
		const result = await this.database.execute(query);

		return id;
	}

	async delete(...ids: string[]): Promise<boolean> {
		const query = q.delete(this.collection.name, this.collection.namespace).in('id', ids);
		const result = await this.database.execute(query);
		ids.forEach(id => this.loader.clear(id));
		return result.acknowledge;
	}

	async relation<O>(
		field: string,
		options: {
			locale?: string
			fields?: string[]
			condition?: Bitwise | Comparison
			offset?: number
			limit?: number
		}
	): Promise<WithID<O>[]> {
		// TODO Dataloader.loadMany https://github.com/facebook/dataloader#loadmanykeys
		// TODO localized fields, condition and results
		throw new Error(`Model.relation not implemented yet.`);
	}

	private localizeInput<I>(data: any): I {
		return Object.keys(data).reduce((obj, key) => {
			const val = data[key];

			let localized = false;
			for (let i = 0, l = this.schema.fields.length; i < l; ++i) {
				if (this.schema.fields[i].handle === key && this.schema.fields[i].localized === true) {
					localized = true;
					break;
				}
			}

			if (localized) {
				this.locales.forEach(code => {
					obj[`${key}__${code}`] = typeof val[code] !== undefined ? val[code] : undefined;
				});
			} else {
				obj[key] = val;
			}

			return obj;
		}, {} as I);
	}

	private localizeResult<O>(data: O, locale?: string, fields?: string[]): O {
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

	private localizeQuery<Q extends Query>(query: Q): Q {
		return query;
	}
}