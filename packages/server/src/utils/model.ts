import { Driver, q, Collection, Bitwise, SortableField, CalcField, FieldExpression, ValueExpression } from "@konstellio/db";


export class ModelFactory<T extends { [field: string]: ValueExpression } = any> {
	
	protected readonly collection: Collection;

	constructor(protected database: Driver, protected handle: string) {
		this.collection = q.collection(handle);
	}

	async findById(id: string): Promise<Model<T>> {
		const result = await this.database.execute<T>(q.select().from(this.collection).eq('id', id));
		if (result.results.length === 0) {
			throw new Error(`Could not find id ${id} in ${this.handle}.`);
		}
		return result.results[0];
	}

	async find(option: {
		condition?: Bitwise,
		sort?: [string, 'asc' | 'desc'][],
		offset?: number,
		limit?: number
	}): Promise<Model<T>[]> {
		let query = q.select().from(this.collection);
		if (option.condition) {
			query = query.where(option.condition);
		}
		if (option.sort) {
			query = query.sort(...option.sort.map<SortableField>(([name, dir]) => q.sort(name, dir)));
		}
		if (typeof option.offset === 'number') {
			query = query.offset(option.offset);
		}
		if (typeof option.limit === 'number') {
			query = query.limit(option.limit);
		}
		const result = await this.database.execute<T>(query);
		return result.results;
	}

	async aggregate(option: {
		fields: { [column: string]: CalcField },
		condition?: Bitwise,
		group?: FieldExpression[],
		sort?: [string, 'asc' | 'desc'][],
		offset?: number,
		limit?: number
	}): Promise<Model<T>[]> {
		let query = q.aggregate(option.fields).from(this.collection);
		if (option.condition) {
			query = query.where(option.condition);
		}
		if (option.group) {
			query = query.group(...option.group);
		}
		if (option.sort) {
			query = query.sort(...option.sort.map<SortableField>(([name, dir]) => q.sort(name, dir)));
		}
		if (typeof option.offset === 'number') {
			query = query.offset(option.offset);
		}
		if (typeof option.limit === 'number') {
			query = query.limit(option.limit);
		}
		const result = await this.database.execute<T>(query);
		return result.results;
	}

	async create(data: T): Promise<Model<T>> {
		const query = q.insert(this.collection.name, this.collection.namespace).fields(data);
		const result = await this.database.execute(query);
		return result.id;
	}

	async update(id: string, data: T): Promise<boolean> {
		const query = q.update(this.collection.name, this.collection.namespace).fields(data).eq('id', id);
		const result = await this.database.execute(query);
		return true;
	}

	async delete(condition: Bitwise): Promise<boolean> {
		let query = q.delete(this.collection.name, this.collection.namespace).where(condition);
		const result = await this.database.execute(query);
		return result.acknowledge;
	}

}

export class Model<T extends { [field: string]: ValueExpression } = any> {

	constructor(public properties: { [field: string]: ValueExpression }) {

	}

}