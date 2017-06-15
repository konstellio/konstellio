import { ADriver } from '../Driver';
import {
	SelectQueryResult,
	AggregateQueryResult,
	InsertQueryResult,
	UpdateQueryResult,
	ReplaceQueryResult,
	DeleteQueryResult
} from '../QueryResult';
import {
	q,
	Expression,
	Bitwise,
	Comparison,
	ComparisonEqual,
	ComparisonIn,
	SelectQuery,
	UnionQuery,
	AggregateQuery,
	InsertQuery,
	UpdateQuery,
	ReplaceQuery,
	DeleteQuery,
	TooComplexQueryError,
	QueryNotSupportedError,
	QuerySyntaxError,
	simplifyBitwiseTree
} from '../Query';
import * as Datastore from '@google-cloud/datastore';
import { List } from 'immutable';

export type DatastoreDriverConstructor = {
	projectId: string,
	namespace?: string,
	apiEndpoint?: string,
	keyFilename?: string,
	email?: string,
	credentials?: {
		client_email: string,
		private_key: string,
	},
	autoRetry?: boolean,
	maxRetries?: number
}

export class DatastoreDriver extends ADriver {

	driver: any

	constructor (options: DatastoreDriverConstructor) {
		super();

		// TODO Managing indexes https://cloud.google.com/datastore/docs/tools/indexconfig

		this.driver = Datastore(options);
	}

	connect(): Promise<DatastoreDriver> {
		return new Promise<DatastoreDriver>((resolve, reject) => {
			resolve(this);
		});
	}

	execute(query: string): Promise<any>
	execute<T>(query: SelectQuery): Promise<SelectQueryResult<T>>
	execute<T>(query: AggregateQuery): Promise<AggregateQueryResult<T>>
	execute<T>(query: UnionQuery): Promise<SelectQueryResult<T>>
	execute<T>(query: InsertQuery): Promise<InsertQueryResult<T>>
	execute<T>(query: UpdateQuery): Promise<UpdateQueryResult<T>>
	execute<T>(query: ReplaceQuery): Promise<ReplaceQueryResult<T>>
	execute(query: DeleteQuery): Promise<DeleteQueryResult>
	execute<T>(query: any): Promise<any> {
		if (typeof query === 'string') {
			return Promise.reject(new QueryNotSupportedError(`Datastore does not support querying with a string.`));
		}
		else if (query instanceof SelectQuery) {
			return this.executeSelect<T>(query);
		}
		else if (query instanceof AggregateQuery) {
			return Promise.reject(new QueryNotSupportedError(`Datastore does not support aggregation query.`));
		}
		else if (query instanceof UnionQuery) {
			return this.executeUnion<T>(query);
		}
		else if (query instanceof InsertQuery) {
			return this.executeInsert<T>(query);
		}
		else if (query instanceof UpdateQuery) {
			return this.executeUpdate<T>(query);
		}
		else if (query instanceof ReplaceQuery) {
			return this.executeReplace<T>(query);
		}
		else if (query instanceof DeleteQuery) {
			return this.executeDelete(query);
		}

		return Promise.reject(new TypeError(`Expected query to be a string, SelectQuery, AggregateQuery, InsertQuery, UpdateQuery, ReplaceQuery or DeleteQuery, got ${typeof query}.`));
	}

	private executeSelect<T> (query: SelectQuery): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			if (query.join()) {
				return reject(new TooComplexQueryError(`Datastore does not support join.`));
			}

			const decomposed = DatastoreDriver.decomposeQuery(query);

			if (decomposed instanceof UnionQuery) {
				return this.executeUnion<T>(decomposed).then(resolve).catch(reject);
			}

			const select = query.select();
			const collection = query.from();
			const where = query.where();
			const sort = query.sort();
			const offset = query.offset();
			const limit = query.limit();

			if (!collection) {
				return reject(new QuerySyntaxError(`SelectQuery needs a collection.`));
			}

			// Has where, no offset
			if (where && offset === 0) {
				// Where has only one comparison
				const operands = where.operands;
				if (operands && operands.count() === 1) {
					const comparison = operands.get(0);

					// Query is q.select(...).from(...).eq('id', '3123').limit(1)
					if (comparison && comparison instanceof ComparisonEqual && comparison.field === 'id' && comparison.value && limit === 1) {
						// TODO We can optimized that into datastore.get(comparison.value, (err, entity) => {})
					}

					// q.select(...).from(...).in('id', ['3123', ...])
					else if (comparison && comparison instanceof ComparisonIn && comparison.field === 'id' && comparison.values) {
						// TODO We can optimized that into datastore.get(comparison.values, (err, entities) => {})
					}
				}
			}

			// const transaction = this.driver.transaction();
			// transaction.run((err) => {
			// 	if (err) {
			// 		return reject(err);
			// 	}

			// 	const from = collection.namespace ? `${collection.namespace}_${collection.name}` : collection.name;
			// 	const fields = select ? select.toArray() : [];

			// 	// let query = this.driver.createQuery(from);
			// });
			
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=runQuery
			reject(new Error(`Not implemented : ${decomposed.toString()}`));
		});
	}

	private executeUnion<T> (query: UnionQuery): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeInsert<T> (query: InsertQuery): Promise<InsertQueryResult<T>> {
		return new Promise<InsertQueryResult<T>>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=insert
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction

			const collection = query.collection();
			if (!collection) {
				return reject(new QuerySyntaxError(`InsertQuery needs a collection.`));
			}

			const transaction = this.driver.transaction();
			transaction.run((err?: Error) => {
				if (err) {
					return reject(err);
				}

				const fields = query.fields()
				const key = this.driver.key([collection.name], { namespace: collection.namespace });
				const data = fields ? fields.toJS() : {};

				transaction.save({
					key: key,
					data: data
				});

				transaction.commit((err?: Error) => {
					if (err) {
						return reject(err);
					}

					resolve(new InsertQueryResult(key.id, data));
				});
			});
		});
	}

	private executeUpdate<T> (query: UpdateQuery): Promise<UpdateQueryResult<T>> {
		return new Promise<UpdateQueryResult<T>>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=update
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction

			// const collection = query.collection();
			// const select = q.select().from(collection.name, collection.namespace).where(query.where()).limit(query.limit());
			
			// this.executeSelect<T>(select)
			// .then(results => {
				
			// })
			// .catch(err => reject(err));
		});
	}

	private executeReplace<T> (query: ReplaceQuery): Promise<ReplaceQueryResult<T>> {
		return new Promise<ReplaceQueryResult<T>>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=update
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction
			reject(new Error(`Not implemented.`));
		});
	}

	private executeDelete (query: DeleteQuery): Promise<DeleteQueryResult> {
		return new Promise<DeleteQueryResult>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=delete
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction
			reject(new Error(`Not implemented.`));
		});
	}

	public static decomposeQuery (query: SelectQuery): SelectQuery | UnionQuery {

		const where = query.where();
		if (where) {
			const decomposed = DatastoreDriver.decomposeBitwiseTree(where);

			if (decomposed.length === 1) {
				const simplified = decomposed[0];
				if (simplified instanceof Comparison) {
					return query.where(q.and(simplified));
				}
				return query.where(simplified);
			}

			const sort = query.sort();
			const offset = query.offset();
			const limit = query.limit();
			
			let union = q.union(...decomposed.map(simplified => {
				if (simplified instanceof Comparison) {
					return query.where(q.and(simplified));
				}
				return query.where(simplified);
			}));

			if (sort) {
				union = union.sort(...sort.toArray());
			}

			if (offset) {
				union = union.offset(offset);
			}

			if (limit) {
				union = union.limit(limit);
			}

			return union;
		}

		return query;
	}

	public static decomposeBitwiseTree (tree: Bitwise): Expression[] {

		const decomposed: Expression[] = [];
		const trees: Bitwise[] = [simplifyBitwiseTree(tree)];

		while (trees.length > 0) {
			const root = <Bitwise>trees.shift();

			if (root.isLeaf) {
				if (root.operator === 'and') {
					decomposed.push(root);
				}
				else if (root.operator === 'or') {
					if (root.operands) {
						decomposed.push(...root.operands.toArray())
					}
				}
				else if (root.operator === 'xor') {
					throw new TooComplexQueryError(`Datastore does not support XOR bitwise operation.`);
				}
			}
			else {
				const walk = [root];

				while (walk.length > 0) {
					const node = <Bitwise>walk.shift();

					// Split on OR node and break
					if (node.operator === 'or') {
						if (node.operands) {
							trees.push(...node.operands.map(op => {
								return simplifyBitwiseTree(root.replace(node, op instanceof Comparison ? new Bitwise('and', [op]) : <Bitwise>op, true));
							}).toArray());
						}
						break;
					}

					else if (root.operator === 'xor') {
						throw new TooComplexQueryError(`Datastore does not support XOR bitwise operation.`);
					}

					// Continue walk with nested bitwise node
					else if (node.operands) {
						walk.push(...<Bitwise[]>node.operands.filter(op => op instanceof Bitwise).toArray());
					}
				}
			}
		}
		
		return decomposed;
	}
}