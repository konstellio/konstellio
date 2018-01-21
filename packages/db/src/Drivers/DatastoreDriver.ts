import { Driver } from '../Driver';
import * as QueryResult from '../QueryResult';
import * as Query from '../Query';
import { List } from 'immutable';
// import * as Datastore from '@google-cloud/datastore';
let Datastore; try { Datastore = require('@google-cloud/datastore'); } catch (e) { }

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

export class DatastoreDriver extends Driver {

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
	execute<T>(query: Query.SelectQuery): Promise<QueryResult.SelectQueryResult<T>>
	execute<T>(query: Query.AggregateQuery): Promise<QueryResult.AggregateQueryResult<T>>
	execute<T>(query: Query.UnionQuery): Promise<QueryResult.SelectQueryResult<T>>
	execute<T>(query: Query.InsertQuery): Promise<QueryResult.InsertQueryResult<T>>
	execute<T>(query: Query.UpdateQuery): Promise<QueryResult.UpdateQueryResult<T>>
	execute<T>(query: Query.ReplaceQuery): Promise<QueryResult.ReplaceQueryResult<T>>
	execute(query: Query.DeleteQuery): Promise<QueryResult.DeleteQueryResult>
	execute(query: Query.CreateCollectionQuery): Promise<QueryResult.CreateCollectionQueryResult>;
	execute(query: Query.DescribeCollectionQuery): Promise<QueryResult.DescribeCollectionQueryResult>;
	execute(query: Query.AlterCollectionQuery): Promise<QueryResult.AlterCollectionQueryResult>;
	execute(query: Query.CollectionExistsQuery): Promise<QueryResult.CollectionExistsQueryResult>;
	execute(query: Query.DropCollectionQuery): Promise<QueryResult.DropCollectionQueryResult>;
	execute(query: Query.CreateIndexQuery): Promise<QueryResult.CreateIndexQueryResult>;
	execute(query: Query.DropIndexQuery): Promise<QueryResult.DropIndexQueryResult>;
	execute<T>(query: any): Promise<any> {
		if (typeof query === 'string') {
			return Promise.reject(new Query.QueryNotSupportedError(`Datastore does not support querying with a string.`));
		}
		else if (query instanceof Query.SelectQuery) {
			return this.executeSelect<T>(query);
		}
		else if (query instanceof Query.AggregateQuery) {
			return Promise.reject(new Query.QueryNotSupportedError(`Datastore does not support aggregation query.`));
		}
		else if (query instanceof Query.UnionQuery) {
			return this.executeUnion<T>(query);
		}
		else if (query instanceof Query.InsertQuery) {
			return this.executeInsert<T>(query);
		}
		else if (query instanceof Query.UpdateQuery) {
			return this.executeUpdate<T>(query);
		}
		else if (query instanceof Query.ReplaceQuery) {
			return this.executeReplace<T>(query);
		}
		else if (query instanceof Query.DeleteQuery) {
			return this.executeDelete(query);
		}

		return Promise.reject(new TypeError(`Expected query to be a string, SelectQuery, AggregateQuery, InsertQuery, UpdateQuery, ReplaceQuery or DeleteQuery, got ${typeof query}.`));
	}

	private executeSelect<T> (query: Query.SelectQuery): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			if (query.getJoin()) {
				return reject(new Query.TooComplexQueryError(`Datastore does not support join.`));
			}

			const decomposed = DatastoreDriver.decomposeQuery(query);

			if (decomposed instanceof Query.UnionQuery) {
				return this.executeUnion<T>(decomposed).then(resolve).catch(reject);
			}

			const select = query.getSelect();
			const collection = query.getFrom();
			const where = query.getWhere();
			const sort = query.getSort();
			const offset = query.getOffset();
			const limit = query.getLimit();

			if (!collection) {
				return reject(new Query.QuerySyntaxError(`SelectQuery needs a collection.`));
			}

			// Has where, no offset
			if (where && offset === 0) {
				// Where has only one comparison
				const operands = where.operands;
				if (operands && operands.count() === 1) {
					const comparison = operands.get(0);

					// Query is q.select(...).from(...).eq('id', '3123').limit(1)
					if (comparison && comparison instanceof Query.ComparisonEqual && comparison.field === 'id' && comparison.value && limit === 1) {
						// TODO We can optimized that into datastore.get(comparison.value, (err, entity) => {})
					}

					// q.select(...).from(...).in('id', ['3123', ...])
					else if (comparison && comparison instanceof Query.ComparisonIn && comparison.field === 'id' && comparison.values) {
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

	private executeUnion<T> (query: Query.UnionQuery): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeInsert<T> (query: Query.InsertQuery): Promise<QueryResult.InsertQueryResult<T>> {
		return new Promise<QueryResult.InsertQueryResult<T>>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=insert
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction

			const collection = query.getCollection();
			if (!collection) {
				return reject(new Query.QuerySyntaxError(`InsertQuery needs a collection.`));
			}

			const transaction = this.driver.transaction();
			transaction.run((err?: Error) => {
				if (err) {
					return reject(err);
				}

				const fields = query.getFields()
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

					resolve(new QueryResult.InsertQueryResult(key.id, data));
				});
			});
		});
	}

	private executeUpdate<T> (query: Query.UpdateQuery): Promise<QueryResult.UpdateQueryResult<T>> {
		return new Promise<QueryResult.UpdateQueryResult<T>>((resolve, reject) => {
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

	private executeReplace<T> (query: Query.ReplaceQuery): Promise<QueryResult.ReplaceQueryResult<T>> {
		return new Promise<QueryResult.ReplaceQueryResult<T>>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=update
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction
			reject(new Error(`Not implemented.`));
		});
	}

	private executeDelete (query: Query.DeleteQuery): Promise<QueryResult.DeleteQueryResult> {
		return new Promise<QueryResult.DeleteQueryResult>((resolve, reject) => {
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=delete
			// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/0.8.0/datastore?method=transaction
			reject(new Error(`Not implemented.`));
		});
	}

	public static decomposeQuery (query: Query.SelectQuery): Query.SelectQuery | Query.UnionQuery {

		const where = query.getWhere();
		if (where) {
			const decomposed = DatastoreDriver.decomposeBitwiseTree(where);

			if (decomposed.length === 1) {
				const simplified = decomposed[0];
				if (simplified instanceof Query.Comparison) {
					return query.where(Query.q.and(simplified));
				}
				return query.where(simplified);
			}

			const sort = query.getSort();
			const offset = query.getOffset();
			const limit = query.getLimit();
			
			let union = Query.q.union(...decomposed.map(simplified => {
				if (simplified instanceof Query.Comparison) {
					return query.where(Query.q.and(simplified));
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

	public static decomposeBitwiseTree (tree: Query.Bitwise): Query.Expression[] {

		const decomposed: Query.Expression[] = [];
		const trees: Query.Bitwise[] = [Query.simplifyBitwiseTree(tree)];

		while (trees.length > 0) {
			const root = <Query.Bitwise>trees.shift();

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
					throw new Query.TooComplexQueryError(`Datastore does not support XOR bitwise operation.`);
				}
			}
			else {
				const walk = [root];

				while (walk.length > 0) {
					const node = <Query.Bitwise>walk.shift();

					// Split on OR node and break
					if (node.operator === 'or') {
						if (node.operands) {
							trees.push(...node.operands.map(op => {
								return Query.simplifyBitwiseTree(root.replace(node, op instanceof Query.Comparison ? new Query.Bitwise('and', [op]) : <Query.Bitwise>op, true));
							}).toArray());
						}
						break;
					}

					else if (root.operator === 'xor') {
						throw new Query.TooComplexQueryError(`Datastore does not support XOR bitwise operation.`);
					}

					// Continue walk with nested bitwise node
					else if (node.operands) {
						walk.push(...<Query.Bitwise[]>node.operands.filter(op => op instanceof Query.Bitwise).toArray());
					}
				}
			}
		}
		
		return decomposed;
	}
}