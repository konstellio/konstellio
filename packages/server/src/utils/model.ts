import { Driver, q, Collection, Bitwise, SortableField, CalcField, FieldExpression, ValueExpression, Comparison, SelectQuery, Expression } from "@konstellio/db";
import { Schema } from "./schema";
import { PluginInitContext } from "./plugin";
import ObjectID from "bson-objectid"
import * as Dataloader from "dataloader";

export async function getModels(context: PluginInitContext, schemas: Schema[]): Promise<Map<string, Model>> {
	const models = new Map<string, Model>();

	for (let i = 0, l = schemas.length; i < l; ++i) {
		const schema = schemas[i];

		models.set(schema.handle, new Model(context.database, schema, models));
	}

	return models;
}

export class Model<T extends { id: string, [field: string]: ValueExpression } = { id: string }> {
	
	protected readonly collection: Collection;

	constructor(
		protected readonly database: Driver,
		protected readonly schema: Schema,
		protected readonly models: Map<string, Model>
	) {
		this.collection = q.collection(schema.handle);
	}

	// TODO "localize" results and queries

	async findById(
		id: string,
		options?: {
			fields?: string[]
			locale?: string
		}
	): Promise<T> {
		// TODO Dataloader.load https://github.com/facebook/dataloader#loadkey
		let query = q.select().from(this.collection).eq('id', id).limit(1);

		if (options && options.fields) {
			query = query.select(...options.fields);
		}

		const result = await this.database.execute<T>(query);
		if (result.results.length === 0) {
			throw new Error(`Could not find id ${id} in ${this.schema.handle}.`);
		}

		return result.results[0];
	}

	async findByIds(
		ids: string[],
		options?: {
			fields?: string[]
			locale?: string
		}
	): Promise<T[]> {
		// TODO Dataloader.loadMany https://github.com/facebook/dataloader#loadmanykeys

		let query = q.select().from(this.collection).in('id', ids);

		if (options && options.fields) {
			query = query.select(...options.fields);
		}

		const result = await this.database.execute<T>(query);

		return result.results;
	}

	async findOne(options?: {
		locale?: string
		fields?: string[]
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
	}): Promise<T> {
		let query = q.select().from(this.collection).limit(1);

		if (options) {
			if (options.fields) {
				query = query.select(...options.fields);
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

		const result = await this.database.execute<T>(query);
		if (result.results.length === 0) {
			throw new Error(`Could not find anything matching query in ${this.schema.handle}.`);
		}

		return result.results[0];
	}

	async find(options?: {
		locale?: string
		fields?: string[]
		condition?: Bitwise | Comparison
		sort?: SortableField[]
		offset?: number
		limit?: number
	}): Promise<T[]> {
		let query = q.select().from(this.collection);

		if (options) {
			if (options.fields) {
				query = query.select(...options.fields);
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

		const result = await this.database.execute<T>(query);

		return result.results;
	}

	async aggregate<R>(options?: {
		locale?: string
		fields?: (string | CalcField)[]
		joins?: { [alias: string]: { query: SelectQuery, on: Expression } }
		condition?: Bitwise | Comparison
		group?: FieldExpression[]
		sort?: SortableField[]
		offset?: number
		limit?: number
	}): Promise<R[]> {
		throw new Error(`Model.aggregate not implemented yet.`);
	}

	async create(data: T, locale?: string): Promise<T> {
		const id = ObjectID.generate();
		const obj: T = Object.assign({}, data, { id });

		const query = q.insert(this.collection.name, this.collection.namespace).fields(obj);
		const result = await this.database.execute(query);

		return obj;
	}

	async update(id: string, data: T, locale?: string): Promise<T> {
		throw new Error(`Model.update not implemented yet.`);
	}

	async delete(...ids: string[]): Promise<boolean> {
		// TODO Dataloader.clear https://github.com/facebook/dataloader#clearkey
		throw new Error(`Model.delete not implemented yet.`);
	}

	async relation<R>(
		field: string,
		options: {
			locale?: string
			fields?: (string | CalcField)[]
			condition?: Bitwise | Comparison
			offset?: number
			limit?: number
		}
	): Promise<R[]> {
		// TODO Dataloader.loadMany https://github.com/facebook/dataloader#loadmanykeys
		throw new Error(`Model.relation not implemented yet.`);
	}

}