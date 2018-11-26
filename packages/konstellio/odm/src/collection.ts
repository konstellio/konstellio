import { EventEmitter } from '@konstellio/eventemitter';
import { Database, q, Collection as DBCollection, Field, FieldAs, FieldDirection, BinaryExpression, Function, Transaction, QueryDelete } from '@konstellio/db';
import * as assert from 'assert';
import * as Dataloader from "dataloader";
import { Schema, validateSchema } from './schema';

const relationCollection = q.collection('Relation');
const selectRelationQuery = q.select('field', 'source', 'target').from(relationCollection).sort(q.sort('seq', 'asc')).where(q.and(
	q.in(q.field('source'), q.var('sources')),
	q.in(q.field('field'), q.var('fields'))
));
const createRelationQuery = q.insert(relationCollection).add({
	id: q.var('id'),
	collection: q.var('collection'),
	field: q.var('field'),
	source: q.var('source'),
	target: q.var('target'),
	seq: q.var('seq')
});
const deleteRelationQuery = q.delete(relationCollection).where(q.in('source', q.var('sources')));

export interface OptionFindById {
	locale?: string;
}
export interface OptionFindByIdSelect<Columns> {
	locale?: string;
	fields?: Columns[];
}
export interface OptionFindOne<Indexes> {
	locale?: string;
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
}
export interface OptionFindOneSelect<Columns, Indexes> {
	locale?: string;
	fields?: Columns[];
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
}
export interface OptionFindMany<Indexes> {
	locale?: string;
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}
export interface OptionFindManySelect<Columns, Indexes> {
	locale?: string;
	fields?: Columns[];
	condition?: BinaryExpression<Indexes>;
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}
export interface OptionAggregate<Indexes> {
	locale?: string;
	condition?: BinaryExpression<Indexes>;
	group?: (Field<Indexes> | Function<Indexes>)[];
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}
export interface OptionAggregateSelect<Columns, Indexes> {
	locale?: string;
	fields?: Columns[];
	condition?: BinaryExpression<Indexes>;
	group?: (Field<Indexes> | Function<Indexes>)[];
	sort?: FieldDirection<Indexes>[];
	offset?: number;
	limit?: number;
}

export class Collection<Columns = any, Indexes = any> extends EventEmitter {

	private deleteQuery: QueryDelete;
	
	public readonly collection: DBCollection;
	public readonly schema: Schema;

	constructor(
		private readonly database: Database,
		private readonly locales: string[],
		schema: Schema
	) {
		super();
		
		assert(validateSchema(schema), `Parameter \`schema\` is not a valid Schema.`);

		this.schema = schema;
		this.collection = q.collection(this.schema.handle);
		this.deleteQuery = q.delete(this.collection).where(q.eq('id', q.var('id')));
	}

	async findById(id: string, options?: OptionFindById): Promise<Columns>;
	async findById<K extends keyof Columns>(id: string, options?: OptionFindByIdSelect<K>): Promise<Pick<Columns, K>>;
	async findById<K extends keyof Columns>(id: string, options?: OptionFindById | OptionFindByIdSelect<K>): Promise<Columns | Pick<Columns, K>> {
		return {} as any;
	}

	async findByIds(ids: string[], options?: OptionFindById): Promise<Columns[]>;
	async findByIds<K extends keyof Columns>(ids: string[], options?: OptionFindByIdSelect<K>): Promise<Pick<Columns, K>[]>;
	async findByIds<K extends keyof Columns>(ids: string[], options?: OptionFindById | OptionFindByIdSelect<K>): Promise<Columns[] | Pick<Columns, K>[]> {
		return [];
	}

	async findOne(options?: OptionFindOne<Indexes>): Promise<Columns>;
	async findOne<K extends keyof Columns>(options?: OptionFindOneSelect<K, Indexes>): Promise<Pick<Columns, K>>;
	async findOne<K extends keyof Columns>(options?: OptionFindOne<Indexes> | OptionFindOneSelect<K, Indexes>): Promise<Columns | Pick<Columns, K>> {
		return {} as any;
	}

	async findMany(options?: OptionFindMany<Indexes>): Promise<Columns[]>;
	async findMany<K extends keyof Columns>(options?: OptionFindManySelect<K, Indexes>): Promise<Pick<Columns, K>[]>;
	async findMany<K extends keyof Columns>(options?: OptionFindMany<Indexes> | OptionFindManySelect<K, Indexes>): Promise<Columns[] | Pick<Columns, K>[]> {
		return [];
	}

	async aggregate(options?: OptionAggregate<Indexes>): Promise<Columns[]>;
	async aggregate<K extends keyof Columns>(options?: OptionAggregateSelect<K, Indexes>): Promise<Pick<Columns, K>[]>;
	async aggregate<K extends keyof Columns>(options?: OptionAggregate<Indexes> | OptionAggregateSelect<K, Indexes>): Promise<Columns[] | Pick<Columns, K>[]> {
		return [];
	}

	create(data: Columns): Promise<string>;
	create(data: Columns, transaction: Transaction): void;
	create(data: Columns | Columns[], transaction?: Transaction): Promise<string> | Promise<string[]> | void {
		
	}

	replace(id: string, data: Columns): Promise<void>;
	replace(id: string, data: Columns, transaction: Transaction): void;
	replace(id: string, data: Columns, transaction?: Transaction): Promise<void> | void {
		
	}

	delete(id: string): Promise<void>;
	delete(id: string, transaction: Transaction): void;
	delete(id: string, transaction?: Transaction): Promise<void> | void {
		if (transaction) {
			transaction.execute(this.deleteQuery, { id });
			return;
		} else {
			return new Promise(async resolve => {
				const transaction = await this.database.transaction();
				transaction.execute(this.deleteQuery, { id });
				await transaction.commit();
				resolve();
			});
		}
	}

	validate(data: any, errors: Error[] = []): data is Columns {
		return false;
	}

}

// interface User {
// 	id: string;
// 	username: string;
// 	password: string;
// 	birthdate?: Date;
// }

// interface UserIndex {
// 	id: string;
// 	username: string;
// }

// class Bleh<F = any, I = any> {

// 	async findOne<T extends keyof F>(
// 		// options: {
// 		// 	locale?: string,
// 		// 	fields?: (Field | FieldAs)[],
// 		// 	condition?: BinaryExpression,
// 		// 	group?: (Field | Function)[],
// 		// 	sort?: FieldDirection[],
// 		// 	offset?: number,
// 		// 	limit?: number
// 		// } = {}
// 		options: {
// 			fields?: (T | Field<F> | FieldAs<F>)[],
// 			condition?: BinaryExpression<I>,
// 			sort?: FieldDirection<I>[],
// 		} = {}
// 	): Promise<Pick<F, T>> {
// 		return {} as any;
// 	}

// }

// (async () => {
// 	const User = new Bleh<User, UserIndex>();

// 	const row = await User.findOne({
// 		fields: ['id', 'birthdate'],
// 		condition: q.and(
// 			q.eq('username', 123),
// 			q.eq('birthdate', Date())
// 		)
// 	});

// 	console.log(row.id);
// 	console.log(row.username);
// 	console.log(row.birthdate);


// });