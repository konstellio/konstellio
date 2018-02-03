import { Driver } from '../Driver';
import * as QueryResult from '../QueryResult';
import * as Query from '../Query';
import { List } from 'immutable';
// import * as SQLite from 'sqlite3';
let SQLite; try { SQLite = require('sqlite3'); } catch (e) { }

export type SQLiteDriverConstructor = {
	filename?: string,
	mode?: number,
	verbose?: boolean
}

export type SQLiteQueryResult = {
	lastId: string,
	changes: any[]
}

export class SQLiteDriver extends Driver {

	options: SQLiteDriverConstructor
	driver: any

	constructor (options: SQLiteDriverConstructor) {
		super();
		this.options = options;
	}

	connect(): Promise<SQLiteDriver> {
		return new Promise<SQLiteDriver>((resolve, reject) => {
			this.driver = new SQLite.Database(
				this.options.filename,
				this.options.mode || (SQLite.OPEN_READWRITE | SQLite.OPEN_CREATE),
				(err) => {
					if (err) {
						return reject(err);
					}
					resolve(this);
				}
			);
		});
	}

	execute(query: string): Promise<SQLiteQueryResult>
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
			return this.executeSQL(query);
		}
		else if (query instanceof Query.SelectQuery) {
			return this.executeSelect<T>(query);
		}
		else if (query instanceof Query.AggregateQuery) {
			return this.executeAggregate<T>(query);
		}
		else if (query instanceof Query.UnionQuery) {
			return this.executeUnion<T>(query);
		}
		else if (query instanceof Query.InsertQuery) {
			return this.executeInsert<T>(query);
		}
		else if (query instanceof Query.ReplaceQuery) {
			return Promise.reject(new Query.QueryNotSupportedError(`SQLite does not support ReplaceQuery.`));
		}
		else if (query instanceof Query.UpdateQuery) {
			return this.executeUpdate<T>(query);
		}
		else if (query instanceof Query.DeleteQuery) {
			return this.executeDelete(query);
		}
		else if (query instanceof Query.DescribeCollectionQuery) {
			return this.executeDescribeCollection(query);
		}

		return Promise.reject(new TypeError(`Unsupported query, got ${typeof query}.`));
	}

	private executeSQL (query: string): Promise<SQLiteQueryResult | QueryResult.SelectQueryResult<any>> {
		return new Promise<SQLiteQueryResult | QueryResult.SelectQueryResult<any>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://github.com/mapbox/node-sqlite3/wiki/API#databaserunsql-param--callback
			if (query.replace(/^[\s(]+/, '').substr(0, 5).toUpperCase() === 'SELECT') {
				this.driver.all(query, (err, rows) => {
					if (err) {
						return reject(err);
					}

					const result = new QueryResult.SelectQueryResult<any>(rows as any[]);

					return resolve(result);
				});
			} else {
				this.driver.run(query, function (err) {
					if (err) {
						return reject(err);
					}

					const result: SQLiteQueryResult = {
						lastId: this.lastId,
						changes: this.changes
					};

					return resolve(result);
				});
			}
		});
	}

	private executeSelect<T> (query: Query.SelectQuery): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_select.html

			// let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);
			let [sql, params] = convertQueryToSQL(query);
			
			this.driver.all(sql, params, (err, rows) => {
				if (err) {
					return reject(err);
				}

				const results = new QueryResult.SelectQueryResult<T>(rows as T[]);
				return resolve(results);
			});
		});
	}

	private executeAggregate<T> (query: Query.AggregateQuery): Promise<QueryResult.AggregateQueryResult<T>> {
		return new Promise<QueryResult.AggregateQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_aggfunc.html
			
			let [sql, params] = convertQueryToSQL(query);
			
			this.driver.all(sql, params, (err, rows) => {
				if (err) {
					return reject(err);
				}

				const results = new QueryResult.SelectQueryResult<T>(rows as T[]);
				return resolve(results);
			});
		});
	}

	private executeUnion<T> (query: Query.UnionQuery): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_select.html#x1326
			
			let [sql, params] = convertQueryToSQL(query);
			
			this.driver.all(sql, params, (err, rows) => {
				if (err) {
					return reject(err);
				}

				const results = new QueryResult.SelectQueryResult<T>(rows as T[]);
				return resolve(results);
			});
		});
	}

	private executeInsert<T> (query: Query.InsertQuery): Promise<QueryResult.InsertQueryResult<T>> {
		return new Promise<QueryResult.InsertQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_insert.html

			let [sql, params] = convertQueryToSQL(query);

			this.driver.run(sql, params, function (err) {
				if (err) {
					return reject(err);
				}
				const fields = query.getFields();
				const data: T = fields ? fields.toJS() : {}
				const result = new QueryResult.InsertQueryResult<T>(this.lastId, data);

				return resolve(result);
			});
		});
	}

	private executeUpdate<T> (query: Query.UpdateQuery): Promise<QueryResult.UpdateQueryResult<T>> {
		return new Promise<QueryResult.UpdateQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_update.html

			let [sql, params] = convertQueryToSQL(query);
			
			this.driver.run(sql, params, function (err) {
				if (err) {
					return reject(err);
				}
				const fields = query.getFields();
				const data: T = fields ? fields.toJS() : {}
				const result = new QueryResult.UpdateQueryResult<T>(data);

				return resolve(result);
			});
		});
	}

	private executeDelete (query: Query.DeleteQuery): Promise<QueryResult.DeleteQueryResult> {
		return new Promise<QueryResult.DeleteQueryResult>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_delete.html

			let [sql, params] = convertQueryToSQL(query);

			this.driver.run(sql, params, function (err) {
				if (err) {
					return reject(err);
				}

				const result = new QueryResult.DeleteQueryResult(this.changes > 0);
				resolve(result);
			});
		});
	}

	private executeDescribeCollection(query: Query.DescribeCollectionQuery): Promise<QueryResult.DescribeCollectionQueryResult> {
		return new Promise<QueryResult.DescribeCollectionQueryResult>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/pragma.html

			const collection = query.getCollection()!;
			const table_name = `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;

			Promise.all<any[], any[], boolean>([
				new Promise(resolve => {
					this.driver.all(`PRAGMA table_info(${table_name})`, [], (err, columns) => {
						resolve(err ? [] : columns);
					});
				}),
				new Promise(resolve => {
					this.driver.all(`PRAGMA index_list(${table_name})`, [], (err, indexes) => {
						if (err) return resolve([]);

						Promise.all(indexes.map(index => new Promise(resolve => {
							this.driver.all(`PRAGMA index_xinfo(${index.name})`, [], (err, columns) => {
								if (err) return resolve();
								resolve({
									name: index.name,
									type: index.unique!! ? 'unique' : 'index',
									columns: columns || []
								});
							});
						})))
						.then((indexes) => resolve(indexes));
					});
				}),
				new Promise(resolve => {
					this.driver.all(`SELECT "auto" FROM sqlite_master WHERE tbl_name=? AND sql LIKE "%AUTOINCREMENT%"`, [table_name], (err, rows) => {
						if (err || rows.length === 0) return resolve(false);
						resolve(true);
					});
				})
			])
			.then(([colDefs, idxDefs, auto]) => {

				const columns = colDefs.map<Query.Column>(col => {
					let type: Query.ColumnType = Query.ColumnType.String;
					switch (col.type) {
						case 'TEXT': break;
						case 'INTEGER': type = Query.ColumnType.Int64; break;
						case 'REAL':
						case 'NUMERIC': type = Query.ColumnType.Float64; break;
						case 'BLOB': type = Query.ColumnType.String; break;
					}
					return new Query.Column(col.name, type, col.dflt_value, col.pk!! ? auto : false);
				});

				const indexes = idxDefs.map<Query.Index>(idx => {
					let type: Query.IndexType = Query.IndexType.Index;
					switch (idx.type) {
						case 'unique': type = Query.IndexType.Unique; break;
					}
					const cols = idx.columns.filter(col => col.cid > -1).sort((a, b) => a.seqno - b.seqno);
					return new Query.Index(idx.name, type).columns(cols.map(col => {
						return new Query.SortableField(col.name, col.desc!! ? 'desc' : 'asc');
					}));
				});

				const primaryKeys = colDefs.filter(col => col.pk!!).map(col => new Query.Index(`${table_name}_${col.name}`, Query.IndexType.Primary).columns(col.name, 'asc'))

				const result = new QueryResult.DescribeCollectionQueryResult(
					columns,
					indexes
				);

				resolve(result);
			});
		});
	}
}

export function convertQueryToSQL(query: Query.Query): [string, any[]] {
	const params: any[] = [];
	const sql = Query.visit<string>(query, {
		Collection: (node) => {
			return `${node.namespace ? `${node.namespace}_` : ''}${node.name}`;
		},
		Field: (node) => {
			return `${node.table ? `${node.table}_` : ''}${node.name}`;
		},
		SortableField: (node) => {
			return `${node.name} ${node.direction || 'ASC'}`;
		},
		CalcField: (results) => {
			return ['concat', 'min', 'max'].indexOf(results.function) === -1
				? `${results.function.toUpperCase()}(${results.value})`
				: `${results.function.toUpperCase()}(${results.values.map(', ')})`;
		},
		Comparison: (results) => {
			if (results.operator === 'in') {
				params.push(...results.values);
				return `${results.field} IN (${results.values.map(v => '?').join(', ')})`;
			}
			else {
				params.push(results.value);
				return `${results.field} ${results.operator} ?`;
			}
		},
		Bitwise: (results) => {
			return `${results.operands.join(` ${results.operator.toUpperCase()} `)}`;
		},
		SelectQuery: {
			leave(results) {
				let sql = '';
				sql += `SELECT ${results.select ? results.select.join(', ') : '*'} `;
				sql += `FROM ${results.from} `;
				if (results.join) {
					results.join.forEach(join => {
						sql += `JOIN (${join.query}) AS ${join.alias} ON ${join.on} `
					});
				}
				if (results.where) {
					sql += `WHERE ${results.where} `;
				}
				if (results.limit) {
					sql += `LIMIT ${results.limit} `;
				}
				if (results.offset) {
					sql += `OFFSET ${results.offset} `;
				}
				return sql;
			}
		},
		UnionQuery: {
			leave(results) {
				let sql = `(${results.selects.join(') UNION (')}) `;
				if (results.sort) {
					sql += `SORT BY ${results.sort.join(', ')} `;
				}
				if (results.limit) {
					sql += `LIMIT ${results.limit} `;
				}
				if (results.offset) {
					sql += `OFFSET ${results.offset} `;
				}
				return sql;
			}
		},
		AggregateQuery: {
			leave(results) {
				let sql = `SELECT `;
				sql += `${results.select ? results.select.join(', ') : '*'} `;
				sql += `FROM ${results.from} `;
				if (results.join) {
					results.join.forEach(join => {
						sql += `JOIN (${join.query}) AS ${join.alias} ON ${join.on} `
					});
				}
				if (results.where) {
					sql += `WHERE ${results.where} `;
				}
				if (results.sort) {
					sql += `GROUP BY ${results.group.join(', ')} `;
				}
				if (results.sort) {
					sql += `SORT BY ${results.sort.join(', ')} `;
				}
				if (results.limit) {
					sql += `LIMIT ${results.limit} `;
				}
				if (results.offset) {
					sql += `OFFSET ${results.offset} `;
				}
				return sql;
			}
		},
		InsertQuery: {
			leave(results) {
				let sql = `INSERT INTO ${results.collection}`;
				sql += `(${results.fields.map((value, key) => key).join(', ')}) VALUES `;
				sql += `(${results.fields.map((value) => {
					params.push(value);
					return '?';
				}).join(', ')})`;
				return sql;
			}
		},
		UpdateQuery: {
			leave(results) {
				let sql = `UPDATE ${results.collection} SET `;
				sql += `${results.fields.map((value, key) => {
					params.push(value);
					return `${key} = ?`;
				}).join(', ')} `;
				if (results.where) {
					sql += `WHERE ${results.where} `;
				}
				// if (results.limit) {
				// 	sql += `LIMIT ${results.limit} `;
				// }
				return sql;
			}
		},
		DeleteQuery: {
			leave(results) {
				let sql = `DELETE FROM ${results.collection} `;
				if (results.where) {
					sql += `WHERE ${results.where} `;
				}
				// if (results.limit) {
				// 	sql += `LIMIT ${results.limit} `;
				// }
				return sql;
			}
		},
		DescribeCollectionQuery: {
			leave(results) {
				return `PRAGMA table_info(${results.collection})`;
			}
		}
	})!;

	return [sql, params];
}

/*

CREATE INDEX `foo_id` ON `foo` (
	`id` ASC
);

CREATE UNIQUE INDEX `foo_id` ON `foo` (
	`id` ASC,
	`date` ASC
);

*/