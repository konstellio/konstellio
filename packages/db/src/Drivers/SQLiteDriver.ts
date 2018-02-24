import { Driver, Compare } from '../Driver';
import {
	SelectQueryResult,
	AggregateQueryResult,
	DeleteQueryResult,
	InsertQueryResult,
	ReplaceQueryResult,
	UpdateQueryResult,
	ShowCollectionQueryResult,
	DescribeCollectionQueryResult,
	CreateCollectionQueryResult,
	AlterCollectionQueryResult,
	CollectionExistsQueryResult,
	DropCollectionQueryResult
} from '../QueryResult';
import {
	q,
	Query,
	SelectQuery,
	UnionQuery,
	AggregateQuery,
	InsertQuery,
	UpdateQuery,
	ReplaceQuery,
	DeleteQuery,
	ShowCollectionQuery,
	DescribeCollectionQuery,
	CreateCollectionQuery,
	AlterCollectionQuery,
	CollectionExistsQuery,
	DropCollectionQuery,
	Collection,
	Field,
	SortableField,
	CalcField,
	CountCalcField,
	AverageCalcField,
	SubCalcField,
	SumCalcField,
	MaxCalcField,
	MinCalcField,
	ConcatCalcField,
	Variable,
	Variables,
	Column,
	ColumnType,
	Index,
	IndexType,
	Comparison,
	ComparisonSimple,
	ComparisonIn,
	Bitwise,
	ChangeAddColumn,
	ChangeAlterColumn,
	ChangeDropColumn,
	ChangeAddIndex,
	ChangeDropIndex,
	QueryNotSupportedError,
	traverseQuery
} from '../Query';
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
	changes: number
}

function runQuery(driver: SQLiteDriver, sql: string, params = [] as any[]): Promise<SQLiteQueryResult> {
	return new Promise((resolve, reject) => {
		driver.driver.run(sql, params, function (err) {
			if (err) return reject(err);
			resolve({
				changes: this.changes,
				lastId: this.lastID
			});
		});
	});
}

function allQuery<T = any> (driver: SQLiteDriver, sql: string, params = [] as any[]): Promise<T[]> {
	return new Promise((resolve, reject) => {
		driver.driver.all(sql, params, function (err, results) {
			if (err) return reject(err);
			resolve(results as T[]);
		});
	});
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

	execute(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult>;
	execute<T>(query: SelectQuery, variables?: Variables): Promise<SelectQueryResult<T>>;
	execute<T>(query: AggregateQuery, variables?: Variables): Promise<AggregateQueryResult<T>>;
	execute<T>(query: UnionQuery, variables?: Variables): Promise<SelectQueryResult<T>>;
	execute<T>(query: InsertQuery, variables?: Variables): Promise<InsertQueryResult<T>>;
	execute<T>(query: UpdateQuery, variables?: Variables): Promise<UpdateQueryResult<T>>;
	execute<T>(query: ReplaceQuery, variables?: Variables): Promise<ReplaceQueryResult<T>>;
	execute(query: DeleteQuery, variables?: Variables): Promise<DeleteQueryResult>;
	execute(query: CreateCollectionQuery): Promise<CreateCollectionQueryResult>;
	execute(query: DescribeCollectionQuery): Promise<DescribeCollectionQueryResult>;
	execute(query: AlterCollectionQuery): Promise<AlterCollectionQueryResult>;
	execute(query: CollectionExistsQuery): Promise<CollectionExistsQueryResult>;
	execute(query: DropCollectionQuery): Promise<DropCollectionQueryResult>;
	execute(query: ShowCollectionQuery): Promise<ShowCollectionQueryResult>;
	execute<T>(query: any, variables?: any): Promise<any> {
		if (typeof query === 'string') {
			return this.executeSQL(query, variables);
		}
		else if (query instanceof SelectQuery) {
			return this.executeSelect<T>(query, variables);
		}
		else if (query instanceof AggregateQuery) {
			return this.executeAggregate<T>(query, variables);
		}
		else if (query instanceof UnionQuery) {
			return this.executeUnion<T>(query, variables);
		}
		else if (query instanceof InsertQuery) {
			return this.executeInsert<T>(query, variables);
		}
		else if (query instanceof ReplaceQuery) {
			return Promise.reject(new QueryNotSupportedError(`SQLite does not support Replace`));
		}
		else if (query instanceof UpdateQuery) {
			return this.executeUpdate<T>(query, variables);
		}
		else if (query instanceof DeleteQuery) {
			return this.executeDelete(query, variables);
		}
		else if (query instanceof DescribeCollectionQuery) {
			return this.executeDescribeCollection(query);
		}
		else if (query instanceof CreateCollectionQuery) {
			return this.executeCreateCollection(query);
		}
		else if (query instanceof AlterCollectionQuery) {
			return this.executeAlterCollection(query);
		}
		else if (query instanceof CollectionExistsQuery) {
			return this.executeCollectionExists(query);
		}
		else if (query instanceof DropCollectionQuery) {
			return this.executeDropCollection(query);
		}
		else if (query instanceof ShowCollectionQuery) {
			return this.executeShowCollection(query);
		}
		
		return Promise.reject(new TypeError(`Unsupported query, got ${typeof query}.`));
	}

	compareTypes(a: ColumnType, b: ColumnType): Compare {
		if (columnType(a) === columnType(b)) {
			return Compare.Castable;
		}
		return Compare.Different;
	}

	private async executeSQL(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult | SelectQueryResult<any>> {
		if (query.replace(/^[\s(]+/, '').substr(0, 5).toUpperCase() === 'SELECT') {
			return new SelectQueryResult<any>(await allQuery(this, query, variables));
		} else {
			return runQuery(this, query);
		}
	}

	private async executeSelect<T>(query: SelectQuery, variables?: Variables): Promise<SelectQueryResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const rows = await allQuery<T>(this, stmts[0].sql, stmts[0].params);
		return new SelectQueryResult<T>(rows);
	}

	private async executeAggregate<T>(query: AggregateQuery, variables?: Variables): Promise<AggregateQueryResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const rows = await allQuery<T>(this, stmts[0].sql, stmts[0].params);
		return new SelectQueryResult<T>(rows);
	}

	private async executeUnion<T>(query: UnionQuery, variables?: Variables): Promise<SelectQueryResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const rows = await allQuery<T>(this, stmts[0].sql, stmts[0].params);
		return new SelectQueryResult<T>(rows);
	}

	private async executeInsert<T>(query: InsertQuery, variables?: Variables): Promise<InsertQueryResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const { changes, lastId } = await runQuery(this, stmts[0].sql, stmts[0].params);
		const fields = query.getFields();
		const data: T = fields ? fields.toJS() : {}
		return new InsertQueryResult<T>(lastId.toString(), data);
	}

	private async executeUpdate<T>(query: UpdateQuery, variables?: Variables): Promise<UpdateQueryResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const changes = await runQuery(this, stmts[0].sql, stmts[0].params);
		const fields = query.getFields();
		const data: T = fields ? fields.toJS() : {}
		return new UpdateQueryResult<T>(data);
	}

	private async executeDelete(query: DeleteQuery, variables?: Variables): Promise<DeleteQueryResult> {
		const stmts = convertQueryToSQL(query, variables);
		const { changes } = await runQuery(this, stmts[0].sql, stmts[0].params);
		return new DeleteQueryResult(changes > 0);
	}

	private async executeShowCollection(query: ShowCollectionQuery): Promise<ShowCollectionQueryResult> {
		return allQuery<{ name: string }>(this, `SELECT name FROM sqlite_master WHERE type="table"`).then((tables) => {
			return new ShowCollectionQueryResult(tables.filter(({ name }) => name !== 'sqlite_sequence').map<Collection>(({ name }) => {
				const match = name.match(/^([^_]+)_(.*)$/);
				if (match) {
					return q.collection(match[2], match[1]);
				}
				return q.collection(name);
			}));
		});
	}

	private async executeDescribeCollection(query: DescribeCollectionQuery): Promise<DescribeCollectionQueryResult> {
		const collection = query.getCollection();
		if (!collection) {
			throw new Error(`Expected DescribeCollectionQuery to be from a collection.`);
		}

		const table_name = collectionToSQL(query.getCollection()!);

		const [colDefs, idxDefs, auto] = await Promise.all([
			allQuery(this, `PRAGMA table_info(${table_name})`, [])
				.catch(err => [] as any[]),
			allQuery(this, `PRAGMA index_list(${table_name})`, [])
				.then(indexes => Promise.all(indexes.map(index => allQuery(this, `PRAGMA index_xinfo(${index.name})`, []).then(columns => ({
					name: index.name as string,
					type: index.unique!! ? 'unique' : 'index',
					columns: columns || []
				})))))
				.then(indexes => indexes.filter(idx => idx.name.substr(0, 17) !== 'sqlite_autoindex_'))
				.catch(err => [] as {name: string, type: string, columns: any[]}[]),
			allQuery(this, `SELECT "auto" FROM sqlite_master WHERE tbl_name=? AND sql LIKE "%AUTOINCREMENT%"`, [table_name])
				.then(rows => rows.length > 0)
				.catch(err => false)
		]);
		
		const columns = colDefs.map<Column>(col => {
			let type: ColumnType = ColumnType.Text;
			switch (col.type) {
				case 'TEXT': break;
				case 'INTEGER': type = ColumnType.Int64; break;
				case 'REAL':
				case 'NUMERIC': type = ColumnType.Float64; break;
				case 'BLOB': type = ColumnType.Blob; break;
			}
			return new Column(col.name, type, col.dflt_value, col.pk!! ? auto : false);
		});

		const indexes = idxDefs.map<Index>(idx => {
			let type: IndexType = IndexType.Index;
			switch (idx.type) {
				case 'unique': type = IndexType.Unique; break;
			}
			const cols = idx.columns.filter(col => col.cid > -1).sort((a, b) => a.seqno - b.seqno);
			const columns = List<SortableField>(cols.map(col => {
				return new SortableField(col.name, col.desc!! ? 'desc' : 'asc');
			}));
			return new Index(idx.name, type, columns);
		});

		const primaryKeys = colDefs.filter(col => col.pk!!).map(col => new Index(`${table_name}_${col.name}`, IndexType.Primary).columns(col.name, 'asc'))

		return new DescribeCollectionQueryResult(
			collection,
			columns,
			primaryKeys.concat(indexes)
		);
	}

	private executeCreateCollection(query: CreateCollectionQuery): Promise<CreateCollectionQueryResult> {
		return new Promise<CreateCollectionQueryResult>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html

			// Return a list of lambda that return a promise
			const stmts = convertQueryToSQL(query).map<() => Promise<void>>(stmt => () => new Promise((resolve, reject) => {
				this.driver.run(stmt.sql, stmt.params, function (err) {
					if (err) return reject(err);
					// if (this.changes === 0) return reject(new Error(`No changes were made.`));
					resolve();
				});
			}));

			// Run promise one after the other
			stmts.reduce<Promise<void>>((last, stmt) => last.then(stmt), Promise.resolve())
			.then(() => {
				const result = new CreateCollectionQueryResult(true);
				resolve(result);
			})
			.catch(reject);
		});
	}

	private static tmpId: number = 0;

	private async executeAlterCollection(query: AlterCollectionQuery): Promise<AlterCollectionQueryResult> {
		const collection = query.getCollection();
		if (!collection) {
			throw new Error(`Expected AlterCollectionQuery to be from a collection.`);
		}

		const changes = query.getChanges();
		if (!changes) {
			throw new Error(`Expected AlterCollectionQuery to contains at least 1 change.`);
		}

		const description = await this.executeDescribeCollection(q.describeCollection(collection.name, collection.namespace));

		const existingColumns = description.columns.filter(column => {
			return changes.findIndex(c => c !== undefined && c.type === 'dropColumn' && c.column === column.getName()) === -1;
		});

		const newColumns = changes.filter(change => {
			return change !== undefined && change.type === 'addColumn';
		}).map((change: ChangeAddColumn) => change.column).toArray();

		const copyColumns = changes.filter(change => {
			return change !== undefined && change.type === 'addColumn' && change.copyColumn !== undefined;
		}).toArray() as ChangeAddColumn[];

		const renameColumns = changes.reduce<{ [key: string]: Column}>((columns: { [key: string]: Column}, change) => {
			if (change && change.type === 'alterColumn') {
				columns[change.oldColumn] = change.newColumn;
			}
			return columns;
		}, {} as { [key: string]: Column});

		const tmpTable = `konstellio_db_rename_${++SQLiteDriver.tmpId}`;
		const create = q.createCollection(tmpTable).columns(...existingColumns.map(col => renameColumns[col.getName()!] ? renameColumns[col.getName()!] : col).concat(newColumns));
		
		const finalCollection = query.getRename() || collection;

		const insertColumns = existingColumns.map(col => {
			const source = col.getName()!;
			const renamed = renameColumns[source] ? renameColumns[source] : col;
			return {
				target: renamed.getName()!,
				source: source
			}
		}).concat(
			copyColumns.map(change => {
				return {
					target: change.column.getName()!,
					source: change.copyColumn!
				};
			})
		);

		await this.executeCreateCollection(create);
		await runQuery(this, `INSERT INTO ${tmpTable} (${insertColumns.map(col => col.target).join(', ')}) SELECT ${insertColumns.map(col => col.source).join(', ')} FROM ${collectionToSQL(collection)}`, []);
		await runQuery(this, `DROP TABLE ${collectionToSQL(collection)}`, []);
		await runQuery(this, `ALTER TABLE ${tmpTable} RENAME TO ${collectionToSQL(finalCollection)}`, []);

		const existingIndexes = description.indexes.filter(index => {
			return changes.findIndex(c => c !== undefined && (index.getType() === IndexType.Primary || (c.type === 'dropIndex' && c.index === index.getName()))) === -1;
		});

		const newIndexes = changes.filter(change => {
			return change !== undefined && change.type === 'addIndex';
		}).map((change: ChangeAddIndex) => change.index).toArray();

		await Promise.all(existingIndexes.concat(newIndexes).map(index => runQuery(this, indexToSQL(finalCollection, index))));

		return new AlterCollectionQueryResult(true);
	}

	private async executeCollectionExists(query: CollectionExistsQuery): Promise<CollectionExistsQueryResult> {
		const collection = query.getCollection();
		if (!collection) {
			throw new Error(`Expected CollectionExistsQuery to be from a collection.`);
		}

		try {
			const info = await allQuery(this, `PRAGMA table_info(${collectionToSQL(collection)})`, []);
			return new CollectionExistsQueryResult(info.length > 0);
		} catch (e) {
			return new CollectionExistsQueryResult(false);
		}
	}

	private async executeDropCollection(query: DropCollectionQuery): Promise<DropCollectionQueryResult> {
		const collection = query.getCollection();
		if (!collection) {
			throw new Error(`Expected DropCollectionQuery to be from a collection.`);
		}

		try {
			await runQuery(this, `DROP TABLE ${collectionToSQL(collection)}`, []);
			return new DropCollectionQueryResult(true);
		} catch (e) {
			return new DropCollectionQueryResult(false);
		}
	}
}

function collectionToSQL(collection: Collection): string {
	return `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;
}

function fieldToSQL(field: Field): string {
	return `${field.table ? `${field.table}_` : ''}${field.name}`;
}

function sortableFieldToSQL(field: SortableField): string {
	return `${field.name} ${field.direction || 'ASC'}`;
}

function calcFieldToSQL(field: CalcField, variables?: Variables): string {
	if (field instanceof CountCalcField || field instanceof AverageCalcField || field instanceof SumCalcField || field instanceof SubCalcField) {
		return `${field.function.toUpperCase()}(${field.field instanceof Field ? fieldToSQL(field.field) : calcFieldToSQL(field.field, variables)})`;
	}
	else if (field instanceof MaxCalcField || field instanceof MinCalcField || field instanceof ConcatCalcField) {
		return `${field.function.toUpperCase()}(${field.fields.map<string>(field => {
			return field ? (field instanceof Field ? fieldToSQL(field) : calcFieldToSQL(field, variables)) : '';
		}).join(', ')})`;
	}
	else {
		return '';
	}
}

function comparisonToSQL(comparison: Comparison, params: any[], variables?: Variables): string {
	if (comparison instanceof ComparisonSimple) {
		if (comparison.value instanceof Field) {
			return `${comparison.field} ${comparison.operator} ${fieldToSQL(comparison.value)}`;
		} else if (comparison.value instanceof Variable) {
			if (variables === undefined) {
				throw new Error(`Could not find query variable ${comparison.value.name}.`);
			}
			params.push(variables[comparison.value.name]);
			return `${comparison.field} ${comparison.operator} ?`;
		} else {
			params.push(comparison.value);
			return `${comparison.field} ${comparison.operator} ?`;
		}
	}
	else if (comparison instanceof ComparisonIn && comparison.values) {
		return `${comparison.field} IN (${comparison.values.map<string>(value => {
			if (value) {
				if (value instanceof Field) {
					return fieldToSQL(value);
				} else if (value instanceof Variable) {
					if (variables === undefined) {
						throw new Error(`Could not find query variable ${value.name}.`);
					}
					params.push(variables[value.name]);
					return '?';
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

function bitwiseToSQL(bitwise: Bitwise, params: any[], variables?: Variables): string {
	if (bitwise.operands) {
		return `(${bitwise.operands.map<string>(op => {
			if (op instanceof Comparison) {
				return comparisonToSQL(op, params, variables);
			}
			else if (op instanceof Bitwise) {
				return bitwiseToSQL(op, params, variables);
			}
			return '';
		}).join(` ${bitwise.operator.toUpperCase()} `)})`;
	}
	else {
		return '';
	}
}

function selectQueryToSQL(query: SelectQuery, variables?: Variables): Statement {
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
			const joinStm = convertQueryToSQL(join!.query, variables);
			params.push(...joinStm[0].params);
			sql += ` JOIN (${joinStm[0].sql}) AS ${alias} ON ${join!.on}`;
		});
	}
	if (query.getWhere()) {
		sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params, variables)}`;
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

function indexToSQL(collection: Collection, index: Index): string {
	const cols = index.getColumns();
	if (!cols || cols.count() === 0) {
		throw new Error(`Expected index ${index.getName()} to contain at least 1 column.`);
	}
	let def = `CREATE `;
	if (index.getType() === IndexType.Unique) {
		def += `UNIQUE `;
	}
	def += `INDEX ${index.getName()} ON ${collectionToSQL(collection)} (${cols.map<string>(col => col !== undefined ? col.toString() : '').join(', ')})`;

	return def;
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

export type Statement = {
	sql: string
	params: any[]
}

export function convertQueryToSQL(query: Query, variables?: Variables): Statement[] {
	return traverseQuery<Statement[]>(query, {
		SelectQuery(query) {
			return [selectQueryToSQL(query, variables)];
		},
		UnionQuery(query) {
			const params: any[] = [];
			let sql = ``;

			if (query.getSelects()) {
				sql += `(${query.getSelects()!.map<string>(subquery => {
					if (subquery) {
						const stmt = convertQueryToSQL(subquery, variables);
						params.push(...stmt[0].params);
						return stmt[0].sql;
					}
					throw new Error(`Expected a SelectQuery, got ${typeof subquery}.`);
				}).join(') UNION (')})`;
			} else {
				throw new Error(`Expected UnionQuery have at least 1 Select`);
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
			sql += `SELECT ${query.getSelect() ? query.getSelect()!.map<string>(f => f ? calcFieldToSQL(f, variables) : '') : '*'}`;

			if (query.getFrom()) {
				sql += ` FROM ${collectionToSQL(query.getFrom()!)}`;
			} else {
				throw new Error(`Expected SelectQuery to be from a collection.`);
			}
			if (query.getJoin()) {
				query.getJoin()!.forEach((join, alias) => {
					const joinStm = convertQueryToSQL(join!.query, variables);
					params.push(...joinStm[0].params);
					sql += ` JOIN (${joinStm[0].sql}) AS ${alias} ON ${join!.on}`;
				});
			}
			if (query.getWhere()) {
				sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params, variables)}`;
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
				sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params, variables)} `;
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
				sql += ` WHERE ${bitwiseToSQL(query.getWhere()!, params, variables)} `;
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
			const primaryKeys = indexes ? indexes.filter(idx => idx !== undefined && idx.getType() === IndexType.Primary) as List<Index> : List<Index>();
			const otherIndexes = indexes ? indexes.filter(idx => idx !== undefined && idx.getType() !== IndexType.Primary) as List<Index> : List<Index>();

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

			if (!autoColName && primaryKeys.count() > 0) {
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
						stmts.push({ sql: indexToSQL(collection, idx), params: [] });
					}
				});
			}

			return stmts;
		}
	});
}