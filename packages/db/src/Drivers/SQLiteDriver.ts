import { Driver } from '../Driver';
import * as QueryResult from '../QueryResult';
import * as Query from '../Query';
import { List } from 'immutable';
import { join } from 'path';
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
		else if (query instanceof Query.AlterCollectionQuery) {
			return this.executeAlterCollection(query);
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

			const stmts = convertQueryToSQL(query);

			this.driver.all(stmts[0].sql, stmts[0].params, (err, rows) => {
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
			
			const stmts = convertQueryToSQL(query);

			this.driver.all(stmts[0].sql, stmts[0].params, (err, rows) => {
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
			
			const stmts = convertQueryToSQL(query);

			this.driver.all(stmts[0].sql, stmts[0].params, (err, rows) => {
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

			const stmts = convertQueryToSQL(query);

			this.driver.run(stmts[0].sql, stmts[0].params, function (err) {
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

			const stmts = convertQueryToSQL(query);

			this.driver.run(stmts[0].sql, stmts[0].params, function (err) {
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

			const stmts = convertQueryToSQL(query);

			this.driver.run(stmts[0].sql, stmts[0].params, function (err) {
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

			const table_name = collectionToSQL(query.getCollection()!);

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

			// Return a list of lambda that return a promise
			const stmts = convertQueryToSQL(query).map<() => Promise<void>>(stmt => () => new Promise((resolve, reject) => {
				this.driver.run(stmt.sql, stmt.params, function (err) {
					if (err) return reject(err);
					if (this.changes === 0) return reject(new Error(`No changes were made.`));
					resolve();
				});
			}));

			// Run promise one after the other
			stmts.reduce<Promise<void>>((last, stmt) => last.then(stmt), Promise.resolve())
			.then(() => {
				const result = new QueryResult.CreateCollectionQueryResult(true);
				resolve(result);
			})
			.catch(reject);
		});
	}

	private static tmpId: number = 0;

	private async executeAlterCollection(query: Query.AlterCollectionQuery): Promise<QueryResult.AlterCollectionQueryResult> {
		const collection = query.getCollection();
		if (!collection) {
			throw new Error(`Expected AlterCollectionQuery to be from a collection.`);
		}

		const changes = query.getChanges();
		if (!changes) {
			throw new Error(`Expected AlterCollectionQuery to contains at least 1 change.`);
		}

		const description = await this.executeDescribeCollection(Query.q.describeCollection(collection.name, collection.namespace));

		const existingColumns = description.columns.filter(column => {
			return changes.findIndex(c => c !== undefined && c.type === 'dropColumn' && c.column === column.getName()) === -1;
		});

		const newColumns = changes.filter(change => {
			return change !== undefined && change.type === 'addColumn';
		}).map((change: Query.ChangeAddColumn) => change.column).toArray();

		const renameColumns = changes.reduce<{ [key: string]: Query.Column}>((columns: { [key: string]: Query.Column}, change) => {
			if (change && change.type === 'alterColumn') {
				columns[change.oldColumn] = change.newColumn;
			}
			return columns;
		}, {} as { [key: string]: Query.Column});

		const tmpTable = `konstellio_db_rename_${++SQLiteDriver.tmpId}`;
		const create = Query.q.createCollection(tmpTable).columns(...existingColumns.map(col => renameColumns[col.getName()!] ? renameColumns[col.getName()!] : col).concat(newColumns));
		
		await this.executeCreateCollection(create);

		await new Promise((resolve, reject) => {
			this.driver.run(`INSERT INTO ${tmpTable} (${existingColumns.map(col => renameColumns[col.getName()!] ? renameColumns[col.getName()!] : col).map(col => col.getName()!).join(', ')}) SELECT ${existingColumns.map(col => col.getName()!).join(', ')} FROM ${collectionToSQL(collection)}`, [], function (err) {
				if (err) return reject(err);
				resolve();
			});
		});

		await new Promise((resolve, reject) => {
			this.driver.run(`DROP TABLE ${collectionToSQL(collection)}`, [], function (err) {
				if (err) return reject(err);
				resolve();
			});
		});

		const finalCollection = query.getRename() || collection;

		await new Promise((resolve, reject) => {
			this.driver.run(`ALTER TABLE ${tmpTable} RENAME TO ${collectionToSQL(finalCollection)}`, [], function (err) {
				if (err) return reject(err);
				resolve();
			});
		});

		throw new Error(`Extract CreateCollectionQuery index creation to its own function so it can be reused here.`);

		// const result = new QueryResult.AlterCollectionQueryResult(true);
		// return result;

		// CREATE TABLE`sqlitebrowser_rename_column_new_table`(
		// 	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
		// 	`title3`	TEXT,
		// 	`date`	TEXT
		// );
		// INSERT INTO sqlitebrowser_rename_column_new_table SELECT`id`, `title2`, `date` FROM`foo`;
		// PRAGMA defer_foreign_keys
		// PRAGMA defer_foreign_keys = "1";
		// DROP TABLE`foo`;
		// ALTER TABLE`sqlitebrowser_rename_column_new_table` RENAME TO`foo`
		// PRAGMA defer_foreign_keys = "0";
		// CREATE UNIQUE INDEX`foo_id` ON`foo`(
		// 	`id`
		// );
		// CREATE INDEX`foo_date` ON`foo`(
		// 	`id`	ASC,
		// 	`date`	ASC
		// );
	}
}

function collectionToSQL(collection: Query.Collection): string {
	return `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;
}

function fieldToSQL(field: Query.Field): string {
	return `${field.table ? `${field.table}_` : ''}${field.name}`;
}

function sortableFieldToSQL(field: Query.SortableField): string {
	return `${field.name} ${field.direction || 'ASC'}`;
}

function calcFieldToSQL(field: Query.CalcField): string {
	if (field instanceof Query.CountCalcField || field instanceof Query.AverageCalcField || field instanceof Query.SumCalcField || field instanceof Query.SubCalcField) {
		return `${field.function.toUpperCase()}(${field.field instanceof Query.Field ? fieldToSQL(field.field) : calcFieldToSQL(field.field)})`;
	}
	else if (field instanceof Query.MaxCalcField || field instanceof Query.MinCalcField || field instanceof Query.ConcatCalcField) {
		return `${field.function.toUpperCase()}(${field.fields.map<string>(field => {
			return field ? (field instanceof Query.Field ? fieldToSQL(field) : calcFieldToSQL(field)) : '';
		}).join(', ')})`;
	}
	else {
		return '';
	}
}

function comparisonToSQL(comparison: Query.Comparison, params: any[]): string {
	if (comparison instanceof Query.ComparisonSimple) {
		if (comparison.value instanceof Query.Field) {
			return `${comparison.field} ${comparison.operator} ${fieldToSQL(comparison.value)}`;
		} else {
			params.push(comparison.value);
			return `${comparison.field} ${comparison.operator} ?`;
		}
	}
	else if (comparison instanceof Query.ComparisonIn && comparison.values) {
		return `${comparison.field} IN (${comparison.values.map<string>(value => {
			if (value) {
				if (value instanceof Query.Field) {
					return fieldToSQL(value);
				} else {
					params.push(value);
					return '?';
				}
			}
			return '';
		}).join(', ')})`;
	}
	else {
		return '';
	}
}

function bitwiseToSQL(bitwise: Query.Bitwise, params: any[]): string {
	if (bitwise.operands) {
		return `(${bitwise.operands.map<string>(op => {
			if (op instanceof Query.Comparison) {
				return comparisonToSQL(op, params);
			}
			else if (op instanceof Query.Bitwise) {
				return bitwiseToSQL(op, params);
			}
			return '';
		}).join(` ${bitwise.operator.toUpperCase()} `)})`;
	}
	else {
		return '';
	}
}

function selectQueryToSQL(query: Query.SelectQuery): Statement {
	const params: any[] = [];
	let sql = ``;
	sql += `SELECT ${query.getSelect() ? query.getSelect()!.map<string>(f => f ? fieldToSQL(f) : '') : '*'}`;

	if (query.getFrom()) {
		sql += ` FROM ${collectionToSQL(query.getFrom()!)}`;
	} else {
		throw new Error(`Expected SelectQuery to be from a collection.`);
	}
	if (query.getJoin()) {
		query.getJoin()!.forEach((join, alias) => {
			const joinStm = convertQueryToSQL(join!.query);
			params.push(...joinStm[0].params);
			sql += ` JOIN (${joinStm[0].sql}) AS ${alias} ON ${join!.on}`;
		});
	}
	if (query.getWhere()) {
		sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params)}`;
	}
	if (query.getLimit()) {
		sql += ` LIMIT ${query.getLimit()!}`;
	}
	if (query.getOffset()) {
		sql += ` OFFSET ${query.getOffset()!}`;
	}

	return {
		sql,
		params
	}
}

function columnType(type?: Query.ColumnType) {
	switch (type) {
		case Query.ColumnType.Bit:
		case Query.ColumnType.Boolean:
		case Query.ColumnType.Int8:
		case Query.ColumnType.Int16:
		case Query.ColumnType.Int32:
		case Query.ColumnType.Int64:
		case Query.ColumnType.UInt8:
		case Query.ColumnType.UInt16:
		case Query.ColumnType.UInt32:
		case Query.ColumnType.UInt64:
			return 'INTEGER';
		case Query.ColumnType.Float32:
		case Query.ColumnType.Float64:
			return 'REAL';
		case Query.ColumnType.Blob:
			return 'BLOB';
		default:
			return 'TEXT';
	}
}

export type Statement = {
	sql: string
	params: any[]
}

export function convertQueryToSQL(query: Query.Query): Statement[] {
	return Query.traverseQuery<Statement[]>(query, {
		SelectQuery(query) {
			return [selectQueryToSQL(query)];
		},
		UnionQuery(query) {
			const params: any[] = [];
			let sql = ``;

			if (query.getSelects()) {
				sql += `(${query.getSelects()!.map<string>(subquery => {
					if (subquery) {
						const stmt = convertQueryToSQL(subquery);
						params.push(...stmt[0].params);
						return stmt[0].sql;
					}
					throw new Error(`Expected a SelectQuery, got ${typeof subquery}.`);
				}).join(') UNION (')})`;
			} else {
				throw new Error(`Expected UnionQuery have at least 1 SelectQuery.`);
			}
			if (query.getSort()) {
				sql += ` SORT BY ${query.getSort()!.map<string>(sort => sort ? sortableFieldToSQL(sort) : '').join(', ')}`;
			}
			if (query.getLimit()) {
				sql += ` LIMIT ${query.getLimit()!}`;
			}
			if (query.getOffset()) {
				sql += ` OFFSET ${query.getOffset()!}`;
			}

			return [{ sql, params }];
		},
		AggregateQuery(query) {
			const params: any[] = [];
			let sql = ``;
			sql += `SELECT ${query.getSelect() ? query.getSelect()!.map<string>(f => f ? calcFieldToSQL(f) : '') : '*'}`;

			if (query.getFrom()) {
				sql += ` FROM ${collectionToSQL(query.getFrom()!)}`;
			} else {
				throw new Error(`Expected SelectQuery to be from a collection.`);
			}
			if (query.getJoin()) {
				query.getJoin()!.forEach((join, alias) => {
					const joinStm = convertQueryToSQL(join!.query);
					params.push(...joinStm[0].params);
					sql += ` JOIN (${joinStm[0].sql}) AS ${alias} ON ${join!.on}`;
				});
			}
			if (query.getWhere()) {
				sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params)}`;
			}
			if (query.getGroup()) {
				sql += ` GROUP BY ${query.getGroup()!.map<string>(field => field ? fieldToSQL(field) : '').join(', ')}`;
			}
			if (query.getSort()) {
				sql += ` SORT BY ${query.getSort()!.map<string>(sort => sort ? sortableFieldToSQL(sort) : '').join(', ')}`;
			}
			if (query.getLimit()) {
				sql += ` LIMIT ${query.getLimit()!}`;
			}
			if (query.getOffset()) {
				sql += ` OFFSET ${query.getOffset()!}`;
			}

			return [{ sql, params }];
		},
		InsertQuery(query) {
			const params: any[] = [];
			let sql = ``;

			if (query.getCollection()) {
				sql += `INSERT INTO ${collectionToSQL(query.getCollection()!)}`;
			} else {
				throw new Error(`Expected InsertQuery to be from a collection.`);
			}
			if (query.getFields()) {
				sql += `(${query.getFields()!.map<string>((value, key) => key!).join(', ')}) VALUES `;
				sql += `(${query.getFields()!.map<string>((value) => {
					params.push(value);
					return '?';
				}).join(', ')})`;
			} else {
				throw new Error(`Expected InsertQuery to have some data.`);
			}

			return [{ sql, params }];
		},
		UpdateQuery(query) {
			const params: any[] = [];
			let sql = ``;

			if (query.getCollection()) {
				sql += `UPDATE  ${collectionToSQL(query.getCollection()!)} SET`;
			} else {
				throw new Error(`Expected InsertQuery to be from a collection.`);
			}
			if (query.getFields()) {
				sql += ` ${query.getFields()!.map<string>((value, key) => {
					params.push(value);
					return `${key} = ?`;
				}).join(', ')}`;
			} else {
				throw new Error(`Expected UpdateQuery to have some data.`);
			}
			if (query.getWhere()) {
				sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params)} `;
			}
			if (query.getLimit()) {
				throw new Error(`SQLiteDriver does not support UpdateQuery with a limit.`);
			}

			return [{ sql, params }];
		},
		DeleteQuery(query) {
			const params: any[] = [];
			let sql = ``;

			if (query.getCollection()) {
				sql += `DELETE FROM  ${collectionToSQL(query.getCollection()!)}`;
			} else {
				throw new Error(`Expected DeleteQuery to be from a collection.`);
			}
			if (query.getWhere()) {
				sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params)} `;
			}
			if (query.getLimit()) {
				throw new Error(`SQLiteDriver does not support DeleteQuery with a limit.`);
			}

			return [{ sql, params }];
		},
		CreateCollectionQuery(query) {
			const collection = query.getCollection();
			const columns = query.getColumns();
			const indexes = query.getIndexes();

			let params: any[] = [];
			let sql = '';

			if (collection) {
				sql += `CREATE TABLE ${collectionToSQL(query.getCollection()!)}`;
			} else {
				throw new Error(`Expected CreateCollectionQuery to be from a collection.`);
			}

			if (columns === undefined || columns!.count() === 0) {
				throw new Error(`Expected CreateCollectionQuery to have at least one column, got none.`);
			}

			const autoCol = columns.filter(col => col !== undefined && col.getAutoIncrement() === true);
			const primaryKeys = indexes ? indexes.filter(idx => idx !== undefined && idx.getType() === Query.IndexType.Primary) : List<any>();
			const otherIndexes = indexes ? indexes.filter(idx => idx !== undefined && idx.getType() !== Query.IndexType.Primary) : List<any>();

			// if (
			// 	autoCol.count() > 0 && (
			// 	primaryKeys.count() != 1 ||
			// 	primaryKeys.get(0).getColumns() === undefined ||
			// 	primaryKeys.get(0).getColumns()!.filter(col => col!.name === autoCol.get(0).getName()).count() === 0)
			// ) {
			// 	throw new Error(`Expected CreateCollectionQuery to have a single autoincrement column with a corresponding primary index. ${autoCol.count()} ${primaryKeys.count()}`);
			// }
			if (primaryKeys.count() > 1) {
				throw new Error(`Expected CreateCollectionQuery to have a single primary key index. This index can be on multiple columns.`);
			}

			const autoColName = autoCol && autoCol.count() > 0 && autoCol.get(0).getName();

			sql += ` (${columns.map<string>(col => {
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

			const stmts = [{ sql, params }];

			if (otherIndexes && otherIndexes.count() > 0) {
				otherIndexes.forEach(idx => {
					if (idx !== undefined) {
						const params: any[] = [];
						const cols = idx.getColumns();
						if (!cols || cols.count() === 0) {
							throw new Error(`Expected index ${idx.getName()} to contain at least 1 column.`);
						}
						let def = `CREATE `;
						if (idx.getType() === Query.IndexType.Unique) {
							def += `UNIQUE `;
						}
						def += `INDEX ${idx.getName()} ON ${collectionToSQL(collection)} (${cols.map<string>(col => col !== undefined ? col.toString() : '').join(', ')})`;
						
						stmts.push({ sql: def, params });
					}
				});
			}

			return stmts;
		}
	});
}