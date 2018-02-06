import { Driver } from '../Driver';
import * as QueryResult from '../QueryResult';
import * as Query from '../Query';
import { List } from 'immutable';
import { ColumnType, IndexType } from '../index';
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
		else if (query instanceof Query.CreateCollectionQuery) {
			return this.executeCreateCollection(query);
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

			const table_name = collectionName(query.getCollection()!);

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
					let type: Query.ColumnType = Query.ColumnType.Text;
					switch (col.type) {
						case 'TEXT': break;
						case 'INTEGER': type = Query.ColumnType.Int64; break;
						case 'REAL':
						case 'NUMERIC': type = Query.ColumnType.Float64; break;
						case 'BLOB': type = Query.ColumnType.Blob; break;
					}
					return new Query.Column(col.name, type, col.dflt_value, col.pk!! ? auto : false);
				});

				const indexes = idxDefs.map<Query.Index>(idx => {
					let type: Query.IndexType = Query.IndexType.Index;
					switch (idx.type) {
						case 'unique': type = Query.IndexType.Unique; break;
					}
					const cols = idx.columns.filter(col => col.cid > -1).sort((a, b) => a.seqno - b.seqno);
					const columns = List<Query.SortableField>(cols.map(col => {
						return new Query.SortableField(col.name, col.desc!! ? 'desc' : 'asc');
					}));
					const index = new Query.Index(idx.name, type, columns);
					
					return index;
				});

				const primaryKeys = colDefs.filter(col => col.pk!!).map(col => new Query.Index(`${table_name}_${col.name}`, Query.IndexType.Primary).columns(col.name, 'asc'))

				const result = new QueryResult.DescribeCollectionQueryResult(
					columns,
					primaryKeys.concat(indexes)
				);

				resolve(result);
			});
		});
	}

	private executeCreateCollection(query: Query.CreateCollectionQuery): Promise<QueryResult.CreateCollectionQueryResult> {
		return new Promise<QueryResult.CreateCollectionQueryResult>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html

			let [sql, params] = convertQueryToSQL(query);

			this.driver.run(sql, params, function (err) {
				if (err) {
					return reject(err);
				}

				const result = new QueryResult.CreateCollectionQueryResult(this.changes > 0);
				resolve(result);
			});
		});
	}
}

function collectionName(collection: Query.Collection) {
	return `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;
}

function columnType(type?: ColumnType) {
	switch (type) {
		case ColumnType.Bit:
		case ColumnType.Boolean:
		case ColumnType.Int8:
		case ColumnType.Int16:
		case ColumnType.Int32:
		case ColumnType.Int64:
		case ColumnType.UInt8:
		case ColumnType.UInt16:
		case ColumnType.UInt32:
		case ColumnType.UInt64:
			return 'INTEGER';
		case ColumnType.Float32:
		case ColumnType.Float64:
			return 'REAL';
		case ColumnType.Blob:
			return 'BLOB';
		default:
			return 'TEXT';
	}
}

export function convertQueryToSQL(query: Query.Query): [string, any[]] {
	const params: any[] = [];
	const sql = Query.visit<string>(query, {
		Collection: (node) => {
			return collectionName(node);
		},
		Field: (node) => {
			return `${node.table ? `${node.table}_` : ''}${node.name}`;
		},
		SortableField: (node) => {
			return `${node.name} ${node.direction || 'ASC'}`;
		},
		CalcField: (node, members) => {
			return `${members.function.toUpperCase()}(${members.field})`;
		},
		CalcFields: (node, members) => {
			return `${members.function.toUpperCase()}(${members.fields.join(', ')})`;
		},
		Comparison: (node, members) => {
			params.push(members.value);
			return `${members.field} ${members.operator} ?`;
			
		},
		Comparisons: (node, members) => {
			params.push(...members.values.toArray());
			return `${members.field} ${members.operator.toUpperCase()} (${members.values.map(v => '?').join(', ')})`;
		},
		Bitwise: (node, members) => {
			return `${members.operands.join(` ${members.operator.toUpperCase()} `)}`;
		},
		SelectQuery: {
			leave(node, members) {
				let sql = '';
				sql += `SELECT ${members.select ? members.select.join(', ') : '*'} `;
				sql += `FROM ${members.from} `;
				if (members.join) {
					members.join.forEach(join => {
						sql += `JOIN (${join!.query}) AS ${join!.alias} ON ${join!.on} `
					});
				}
				if (members.where) {
					sql += `WHERE ${members.where} `;
				}
				if (members.limit) {
					sql += `LIMIT ${members.limit} `;
				}
				if (members.offset) {
					sql += `OFFSET ${members.offset} `;
				}
				return sql;
			}
		},
		UnionQuery: {
			leave(node, members) {
				if (members.selects) {
					let sql = `(${members.selects.join(') UNION (')}) `;
					if (members.sort) {
						sql += `SORT BY ${members.sort.join(', ')} `;
					}
					if (members.limit) {
						sql += `LIMIT ${members.limit} `;
					}
					if (members.offset) {
						sql += `OFFSET ${members.offset} `;
					}
					return sql;
				}
				return '';
			}
		},
		AggregateQuery: {
			leave(node, members) {
				let sql = `SELECT `;
				sql += `${members.select ? members.select.join(', ') : '*'} `;
				sql += `FROM ${members.from} `;
				if (members.join) {
					members.join.forEach(join => {
						sql += `JOIN (${join!.query}) AS ${join!.alias} ON ${join!.on} `
					});
				}
				if (members.where) {
					sql += `WHERE ${members.where} `;
				}
				if (members.group) {
					sql += `GROUP BY ${members.group.join(', ')} `;
				}
				if (members.sort) {
					sql += `SORT BY ${members.sort.join(', ')} `;
				}
				if (members.limit) {
					sql += `LIMIT ${members.limit} `;
				}
				if (members.offset) {
					sql += `OFFSET ${members.offset} `;
				}
				return sql;
			}
		},
		InsertQuery: {
			leave(node, members) {
				if (members.fields) {
					let sql = `INSERT INTO ${members.collection}`;
					sql += `(${members.fields.map((value, key) => key).join(', ')}) VALUES `;
					sql += `(${members.fields.map((value) => {
						params.push(value);
						return '?';
					}).join(', ')})`;
					return sql;
				}
				return '';
			}
		},
		UpdateQuery: {
			leave(node, members) {
				if (members.fields) {
					let sql = `UPDATE ${members.collection} SET `;
					sql += `${members.fields.map((value, key) => {
						params.push(value);
						return `${key} = ?`;
					}).join(', ')} `;
					if (members.where) {
						sql += `WHERE ${members.where} `;
					}
					// if (members.limit) {
					// 	sql += `LIMIT ${members.limit} `;
					// }
					return sql;
				}
				return '';
			}
		},
		DeleteQuery: {
			leave(node, members) {
				let sql = `DELETE FROM ${members.collection} `;
				if (members.where) {
					sql += `WHERE ${members.where} `;
				}
				// if (members.limit) {
				// 	sql += `LIMIT ${members.limit} `;
				// }
				return sql;
			}
		},
		CreateCollectionQuery: {
			leave(node, { collection }) {
				const columns = node.getColumns();
				const indexes = node.getIndexes();

				if (!columns || columns.count() === 0) {
					throw new Error(`Expected query to have at least one column, got none.`);
				}

				const autoCol = columns.filter(col => col !== undefined && col.getAutoIncrement() === true);
				const primaryKeys = indexes ? indexes.filter(idx => idx !== undefined && idx.getType() === IndexType.Primary) : List<any>();
				const otherIndexes = indexes ? indexes.filter(idx => idx !== undefined && idx.getType() !== IndexType.Primary) : List<any>();

				let sql = `CREATE TABLE ${collection} (`;

				if (
					autoCol.count() > 0 &&
					(
						autoCol.count() != 1 ||
						primaryKeys.count() != 1 ||
						primaryKeys.get(0).getColumns() === undefined ||
						primaryKeys.get(0).getColumns()!.filter(col => col!.name === autoCol.get(0).getName()).count() === 0
					)
				) {
					throw new Error(`Expected a single autoincrement column with a corresponding primary index.`);
				}
				if (primaryKeys.count() > 1) {
					throw new Error(`Expected a single primary key index. This index can be on multiple columns.`);
				}

				const autoColName = autoCol && autoCol.count() > 0 && autoCol.get(0).getName();

				sql += `${columns.map<string>(col => {
					if (col !== undefined) {
						const defaultValue = col.getDefaultValue();

						let def = `${col.getName()} ${columnType(col.getType())}`;
						if (col.getName() === autoColName) {
							def += ` PRIMARY KEY AUTOINCREMENT`;
						}
						if (defaultValue !== undefined && defaultValue !== null) {
							def += ` DEFAULT ${typeof defaultValue === 'number' ? defaultValue : `'${defaultValue}'`}`;
						}
						return def;
					}
					return '';
				}).join(', ')}`;

				if (!autoColName && primaryKeys) {
					const cols = primaryKeys.get(0).getColumns();
					if (cols) {
						sql += `, PRIMARY KEY (${cols.map<string>(col => col !== undefined ? col.toString() : '').join(', ')})`;
					}
				}

				sql += `)`;

				if (otherIndexes && otherIndexes.count() > 0) {
					sql += `; ${otherIndexes.map<string>(idx => {
						if (idx !== undefined) {
							const cols = idx.getColumns();
							if (!cols || cols.count() === 0) {
								throw new Error(`Expected index ${idx.getName()} to contain at least 1 column.`);
							}
							let def = `CREATE `;
							if (idx.getType() === IndexType.Unique) {
								def += `UNIQUE `;
							}
							def += `INDEX ${idx.getName()} ON ${collection} (${cols.map<string>(col => col !== undefined ? col.toString() : '').join(', ')})`;
							return def;
						}
						return '';
					}).join(`;`)}`;
				}

				return sql;
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