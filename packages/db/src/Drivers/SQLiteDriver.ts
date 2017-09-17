import { ADriver } from '../Driver';
import * as QueryResult from '../QueryResult';
import * as Query from '../Query';
import * as SQLite from 'sqlite3';
import { List } from 'immutable';

export type SQLiteDriverConstructor = {
	filename?: string,
	mode?: number,
	verbose?: boolean
}

export type SQLiteQueryResult = {
	lastId: string,
	changes: any[]
}

export class SQLiteDriver extends ADriver {

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

		return Promise.reject(new TypeError(`Expected query to be a string, SelectQuery, AggregateQuery, InsertQuery, UpdateQuery, ReplaceQuery or DeleteQuery, got ${typeof query}.`));
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

			let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);
			
			this.driver.all(command.sql, command.params, (err, rows) => {
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
			
			let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);
			
			this.driver.all(command.sql, command.params, (err, rows) => {
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
			
			let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);
			
			this.driver.all(command.sql, command.params, (err, rows) => {
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

			let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);

			this.driver.run(command.sql, command.params, function (err) {
				if (err) {
					return reject(err);
				}
				const fields = query.fields();
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

			let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);
			
			this.driver.run(command.sql, command.params, function (err) {
				if (err) {
					return reject(err);
				}
				const fields = query.fields();
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

			let command: QueryAccumulator = Query.reduceQuery<QueryAccumulator>(queryToStringReducers, { sql: '', params: [] }, query);

			this.driver.run(command.sql, command.params, function (err) {
				if (err) {
					return reject(err);
				}

				const result = new QueryResult.DeleteQueryResult(this.changes > 0);
				resolve(result);
			});
		});
	}
}

type QueryAccumulator = {
	sql: string
	params: any[]
}

const queryToStringReducers: Query.QueryReducers<QueryAccumulator> = {
	Query (node: Query.Query, accumulator: QueryAccumulator): void {
		
		// Query main keyword
		if (node instanceof Query.SelectQuery || node instanceof Query.AggregateQuery) {
			accumulator.sql += 'SELECT ';
		}
		if (node instanceof Query.InsertQuery) {
			accumulator.sql += 'INSERT INTO ';
		}
		if (node instanceof Query.UpdateQuery) {
			accumulator.sql += 'UPDATE ';
		}
		if (node instanceof Query.DeleteQuery) {
			accumulator.sql += 'DELETE FROM ';
		}
		if (node instanceof Query.UnionQuery) {
			const selects = node.select();
			if (selects) {
				selects.forEach(select => {
					accumulator.sql += ` `;
					Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, <Query.Query>select)
					accumulator.sql += ` UNION`;
				});
				accumulator.sql = accumulator.sql.substr(0, accumulator.sql.length - 6);
				accumulator.sql += ` `;
			}
		}

		// Select ...
		if (node instanceof Query.SelectQuery) {
			const fields = node.select();
			if (fields) {
				fields.forEach(field => {
					Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, <Query.Field>field);
					accumulator.sql += ', ';
				});
				accumulator.sql = accumulator.sql.substr(0, accumulator.sql.length - 2);
				accumulator.sql += ` `;
			} else {
				accumulator.sql += '* ';
			}
		}
		if (node instanceof Query.AggregateQuery) {
			const fields = node.select();
			if (fields) {
				accumulator.sql += fields.map<string>((field, alias) => field && alias ? `${field.toString()} AS ${alias}` : ``).join(', ');
				accumulator.sql += ` `;
			} else {
				accumulator.sql += '* ';
			}
		}

		// Select ... From ...
		if (node instanceof Query.SelectQuery || node instanceof Query.AggregateQuery) {
			const from = node.from();
			if (from) {
				accumulator.sql += `FROM `;
				Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, from);
				accumulator.sql += ` `;
			}
		}

		// Insert ...
		if (node instanceof Query.InsertQuery || node instanceof Query.UpdateQuery || node instanceof Query.DeleteQuery) {
			const collection = node.collection();
			if (collection) {
				Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, collection);
				accumulator.sql += ` `;
			}
		}

		// Values ...
		if (node instanceof Query.InsertQuery) {
			const fields = node.fields();
			if (fields) {
				accumulator.sql += `(${fields.map<string>((value, key) => key || '').join(', ')})`;
				accumulator.sql += ` VALUES `;
				accumulator.sql += `(${fields.map<string>((value, key) => {
					if (value instanceof Query.Field) {
						const subAcc = { sql: '', params: accumulator.params };
						Query.reduceQuery<QueryAccumulator>(queryToStringReducers, subAcc, value);
						return subAcc.sql;
					}
					accumulator.params.push(value);
					return `?`;
				}).join(', ')}) `;
			}
		}

		// Set ...
		if (node instanceof Query.UpdateQuery) {
			const fields = node.fields();
			if (fields) {
				accumulator.sql += `SET `;
				accumulator.sql += `${fields.map<string>((value, key) => {
					if (value instanceof Query.Field) {
						const subAcc = { sql: '', params: accumulator.params };
						Query.reduceQuery<QueryAccumulator>(queryToStringReducers, subAcc, value);
						return `${key} = ${subAcc.sql}`;
					}
					accumulator.params.push(value);
					return `${key} = ?`;
				}).join(', ')} `;
			}
		}

		// Join ...
		if (node instanceof Query.SelectQuery || node instanceof Query.AggregateQuery) {
			const joins = node.join();
			if (joins) {
				joins.forEach((value, alias) => {
					if (value) {
						accumulator.sql += `JOIN (`;
						Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, value.query);
						accumulator.sql += `) AS ${alias} ON `;
						Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, value.on);
						accumulator.sql += ` `;
					}
				})
			}
		}

		// Where ...
		if (node instanceof Query.SelectQuery || node instanceof Query.AggregateQuery || node instanceof Query.UpdateQuery || node instanceof Query.DeleteQuery) {
			const where = node.where();
			if (where) {
				accumulator.sql += `WHERE `;
				Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, where);
				accumulator.sql += ` `;
			}
		}

		// Sort By ...
		if (node instanceof Query.SelectQuery || node instanceof Query.UnionQuery || node instanceof Query.AggregateQuery) {
			const sort = node.sort();
			if (sort) {
				accumulator.sql += `SORT BY `;
				sort.forEach(field => {
					Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, <Query.SortableField>field);
					accumulator.sql += ', ';
				});
				accumulator.sql = accumulator.sql.substr(0, accumulator.sql.length - 2);
				accumulator.sql += ` `;
			}
		}

		// Limit ...
		if (node instanceof Query.SelectQuery || node instanceof Query.UnionQuery || node instanceof Query.AggregateQuery) {
			const limit = node.limit();
			if (limit) {
				accumulator.sql += `LIMIT ${limit} `;
			}
		}

		// Offset ...
		if (node instanceof Query.SelectQuery || node instanceof Query.UnionQuery || node instanceof Query.AggregateQuery) {
			const offset = node.offset();
			if (offset) {
				accumulator.sql += `OFFSET ${offset} `;
			}
		}
	},
	Collection (node: Query.Collection, accumulator: QueryAccumulator): void {
		accumulator.sql += '`';
		if (node.namespace) {
			accumulator.sql += `${node.namespace}_`;
		}
		accumulator.sql += `${node.name}`;
		accumulator.sql += '`';
	},
	Field (node: Query.Field, accumulator: QueryAccumulator): void {
		accumulator.sql += '`';
		if (node.table) {
			accumulator.sql += `${node.table}_`;
		}
		accumulator.sql += `${node.name}`;
		accumulator.sql += '`';
	},
	SortableField (node: Query.SortableField, accumulator: QueryAccumulator): void {
		accumulator.sql += `${node.name} ${node.direction || 'ASC'}`;
	},
	CalcField (node: Query.CalcField, accumulator: QueryAccumulator): void {
		if (
			node instanceof Query.CountCalcField ||
			node instanceof Query.AverageCalcField ||
			node instanceof Query.SumCalcField ||
			node instanceof Query.SubCalcField
		) {
			accumulator.sql += `${node.function.toLocaleUpperCase()}(`;
			Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, node.field);
			accumulator.sql += `)`;
		}
		if (
			node instanceof Query.MaxCalcField ||
			node instanceof Query.MinCalcField ||
			node instanceof Query.ConcatCalcField
		) {
			accumulator.sql += `${node.function.toLocaleUpperCase()}(`;
			node.fields.forEach(field => {
				Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, <Query.Field>field);
				accumulator.sql += `, `;
			});
			accumulator.sql = accumulator.sql.substr(0, accumulator.sql.length - 2);
			accumulator.sql += `)`;
		}
	},
	Comparison (node: Query.Comparison, accumulator: QueryAccumulator): void {
		if (node.field instanceof Query.Field) {
			Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, node.field);
		} else {
			accumulator.sql += node.field;
		}
		if (node instanceof Query.ComparisonSimple) {
			if (node.value instanceof Query.Field) {
				accumulator.sql += ` ${node.operator} `;
				Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, node.value);
			}
			else {
				accumulator.sql += ` ${node.operator} ?`;
				accumulator.params.push(node.value);
			}
		}
		if (node instanceof Query.ComparisonIn) {
			Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, node.field);
			accumulator.sql += ` IN (`;
			if (node.values) {
				node.values.forEach(value => {
					accumulator.sql += '?, ';
					accumulator.params.push(value);
				});
				accumulator.sql = accumulator.sql.substr(0, accumulator.sql.length - 2);
			}
			accumulator.sql += `)`;
		}
	},
	Bitwise (node: Query.Bitwise, accumulator: QueryAccumulator): void {
		if (node.operands) {
			if (node.operands.count() === 1) {
				Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, node.operands.get(0));
			}
			else {
				accumulator.sql += `(`;
				let lastOp = '';
				node.operands.forEach(op => {
					if (op) {
						Query.reduceQuery<QueryAccumulator>(queryToStringReducers, accumulator, op);
						accumulator.sql += `) ${op.operator.toLocaleUpperCase()} (`;
						lastOp = op.operator;
					}
				});
				accumulator.sql = accumulator.sql.substr(0, accumulator.sql.length - 2 - lastOp.length - 2);
				accumulator.sql += `)`;
			}
		}
	}
}