import * as DB from '@konstellio/db';
import { q, Variable } from '@konstellio/db';
import { Pool } from '@konstellio/promised';
import { List } from 'immutable';
import { Database as SQLite, OPEN_READWRITE, OPEN_CREATE } from 'sqlite3';
import { isArray } from 'util';

export type DatabaseSQLiteConstructor = {
	filename: string,
	mode?: number,
	verbose?: boolean
}

export type SQLiteQueryResult = {
	lastId: string,
	changes: number
}

type Mutable<T> = {
	-readonly [P in keyof T]: T[P];
}

export class DatabaseSQLite extends DB.Database {
	readonly features: DB.Features;

	public readonly options: DatabaseSQLiteConstructor
	public readonly driver!: SQLite

	protected readonly transactionPool: Pool<SQLite>;

	constructor (options: DatabaseSQLiteConstructor) {
		super();
		this.options = options;
		this.features = {
			join: true
		}
		this.transactionPool = new Pool();
	}

	connect(): Promise<DatabaseSQLite> {
		return new Promise<DatabaseSQLite>((resolve, reject) => {
			(this as Mutable<DatabaseSQLite>).driver = new SQLite(
				this.options.filename,
				this.options.mode || (OPEN_READWRITE | OPEN_CREATE),
				(err) => {
					if (err) {
						return reject(err);
					}
					resolve(this);
				}
			);
		});
	}

	disconnect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.driver.close((err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	execute(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult>;
	execute<T>(query: DB.QuerySelect, variables?: DB.Variables): Promise<DB.QuerySelectResult<T>>;
	execute<T>(query: DB.QueryAggregate, variables?: DB.Variables): Promise<DB.QueryAggregateResult<T>>;
	execute<T>(query: DB.QueryUnion, variables?: DB.Variables): Promise<DB.QuerySelectResult<T>>;
	execute(query: DB.QueryDescribeCollection): Promise<DB.QueryDescribeCollectionResult>;
	execute(query: DB.QueryCollectionExists): Promise<DB.QueryCollectionExistsResult>;
	execute(query: DB.QueryShowCollection): Promise<DB.QueryShowCollectionResult>;
	execute<T>(query: any, variables?: any): Promise<any> {
		if (typeof query === 'string') {
			return this.executeSQL(query, variables);
		}
		else if (query instanceof DB.QuerySelect) {
			return this.executeSelect<T>(query, variables);
		}
		else if (query instanceof DB.QueryAggregate) {
			return this.executeAggregate<T>(query, variables);
		}
		else if (query instanceof DB.QueryUnion) {
			return this.executeUnion<T>(query, variables);
		}
		else if (query instanceof DB.QueryDescribeCollection) {
			return this.executeDescribeCollection(query);
		}
		else if (query instanceof DB.QueryCollectionExists) {
			return this.executeCollectionExists(query);
		}
		else if (query instanceof DB.QueryShowCollection) {
			return this.executeShowCollection();
		}
		
		return Promise.reject(new TypeError(`Unsupported query, got ${typeof query}.`));
	}

	async transaction(): Promise<TransactionSQLite> {
		return new TransactionSQLite(this);
	}

	// @ts-ignore
	compareTypes(aType: DB.ColumnType, aSize: number, bType: DB.ColumnType, bSize: number): DB.Compare {
		if (columnType(aType) === columnType(bType)) {
			return DB.Compare.Castable;
		}
		return DB.Compare.Different;
	}

	private async executeSQL(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult | DB.QuerySelectResult<any>> {
		if (query.replace(/^[\s(]+/, '').substr(0, 5).toUpperCase() === 'SELECT') {
			return new DB.QuerySelectResult<any>(await allQuery(this.driver, query, variables));
		} else {
			return runQuery(this.driver, query);
		}
	}

	private async executeSelect<T>(query: DB.QuerySelect, variables?: DB.Variables): Promise<DB.QuerySelectResult<T>> {
		const stmts = convertQueryToSQL(query, this, variables);
		const rows = await allQuery<T>(this.driver, stmts[0].sql, stmts[0].params);
		return new DB.QuerySelectResult<T>(rows);
	}

	private async executeAggregate<T>(query: DB.QueryAggregate, variables?: DB.Variables): Promise<DB.QueryAggregateResult<T>> {
		const stmts = convertQueryToSQL(query, this, variables);
		const rows = await allQuery<T>(this.driver, stmts[0].sql, stmts[0].params);
		return new DB.QuerySelectResult<T>(rows);
	}

	private async executeUnion<T>(query: DB.QueryUnion, variables?: DB.Variables): Promise<DB.QuerySelectResult<T>> {
		const stmts = convertQueryToSQL(query, this, variables);
		const rows = await allQuery<T>(this.driver, stmts[0].sql, stmts[0].params);
		return new DB.QuerySelectResult<T>(rows);
	}

	private async executeShowCollection(): Promise<DB.QueryShowCollectionResult> {
		return allQuery<{ name: string }>(this.driver, `SELECT name FROM sqlite_master WHERE type="table"`).then((tables) => {
			return new DB.QueryShowCollectionResult(tables.filter(({ name }) => name !== 'sqlite_sequence').map<DB.Collection>(({ name }) => {
				const match = name.match(/^([^_]+)_(.*)$/);
				if (match) {
					return q.collection(match[2], match[1]);
				}
				return q.collection(name);
			}));
		});
	}

	private async executeDescribeCollection(query: DB.QueryDescribeCollection): Promise<DB.QueryDescribeCollectionResult> {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryDescribeCollection to be from a collection.`);
		}

		const table_name = collectionToSQL(query.collection!);

		const [colDefs, idxDefs, auto] = await Promise.all([
			allQuery(this.driver, `PRAGMA table_info(${table_name})`, [])
				.catch(() => [] as any[]),
			allQuery(this.driver, `PRAGMA index_list(${table_name})`, [])
				.then(indexes => Promise.all(indexes.map(index => allQuery(this.driver, `PRAGMA index_xinfo(${index.name})`, []).then(columns => ({
					name: index.name as string,
					type: index.unique!! ? 'unique' : 'index',
					columns: columns || []
				})))))
				.then(indexes => indexes.filter(idx => idx.name.substr(0, 17) !== 'sqlite_autoindex_'))
				.catch(() => [] as { name: string, type: string, columns: any[] }[]),
			allQuery(this.driver, `SELECT "auto" FROM sqlite_master WHERE tbl_name=${table_name} AND sql LIKE "%AUTOINCREMENT%"`, [])
				.then(rows => rows.length > 0)
				.catch(() => false)
		]);

		const columns = colDefs.map<DB.Column>(col => {
			let type: DB.ColumnType = DB.ColumnType.Text;
			let size: number = -1;
			switch (col.type) {
				case 'TEXT': break;
				case 'INTEGER': type = DB.ColumnType.Int; size = 64; break;
				case 'REAL':
				case 'NUMERIC': type = DB.ColumnType.Float; size = 64; break;
				case 'BLOB': type = DB.ColumnType.Blob; break;
			}
			return new DB.Column(col.name, type, size, col.dflt_value, col.pk!! ? auto : false);
		});

		const indexes = idxDefs.map<DB.Index>(idx => {
			let type: DB.IndexType = DB.IndexType.Index;
			switch (idx.type) {
				case 'unique': type = DB.IndexType.Unique; break;
			}
			const cols = idx.columns.filter(col => col.cid > -1).sort((a, b) => a.seqno - b.seqno);
			const columns = List<DB.FieldDirection>(cols.map(col => {
				return new DB.FieldDirection(q.field(col.name), col.desc!! ? 'desc' : 'asc');
			}));
			return new DB.Index(idx.name, type, columns);
		});

		const primaryKeys = colDefs.filter(col => col.pk!!).map(col => q.index(`${table_name.substr(1, table_name.length - 2)}_${col.name}`, DB.IndexType.Primary, [q.sort(col.name, 'asc')]));

		return new DB.QueryDescribeCollectionResult(
			collection,
			columns,
			primaryKeys.concat(indexes)
		);
	}

	private async executeCollectionExists(query: DB.QueryCollectionExists): Promise<DB.QueryCollectionExistsResult> {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryCollectionExists to be from a collection.`);
		}

		try {
			const info = await allQuery(this.driver, `PRAGMA table_info(${collectionToSQL(collection)})`, []);
			return new DB.QueryCollectionExistsResult(info.length > 0);
		} catch (e) {
			return new DB.QueryCollectionExistsResult(false);
		}
	}
}

export class TransactionSQLite extends DB.Transaction {
	private static tmpId: number = 0;

	protected statements: Statement[];
	protected pendingPromises: Promise<void>[];

	constructor(public readonly database: DatabaseSQLite) {
		super();
		this.statements = [];
		this.pendingPromises = [];
	}
	
	execute(query: string, variables?: (string | number | boolean | Date | null)[]): void;
	execute(query: DB.QueryInsert, variables?: DB.Variables): void;
	execute(query: DB.QueryUpdate, variables?: DB.Variables): void;
	execute(query: DB.QueryDelete, variables?: DB.Variables): void;
	execute(query: DB.QueryCreateCollection): void;
	execute(query: DB.QueryAlterCollection): void;
	execute(query: DB.QueryDropCollection): void;
	execute(query: any, variables?: any): void {
		if (typeof query === 'string') {
			return this.executeSQL(query, variables);
		}
		else if (query instanceof DB.QueryInsert) {
			return this.executeInsert(query, variables);
		}
		else if (query instanceof DB.QueryUpdate) {
			return this.executeUpdate(query, variables);
		}
		else if (query instanceof DB.QueryDelete) {
			return this.executeDelete(query, variables);
		}
		else if (query instanceof DB.QueryCreateCollection) {
			return this.executeCreateCollection(query);
		}
		else if (query instanceof DB.QueryAlterCollection) {
			return this.executeAlterCollection(query);
		}
		else if (query instanceof DB.QueryDropCollection) {
			return this.executeDropCollection(query);
		}

		new TypeError(`Unsupported query, got ${typeof query}.`);
	}

	private executeSQL(query: string, variables?: (string | number | boolean | Date | null)[]): void {
		if (query.replace(/^[\s(]+/, '').substr(0, 5).toUpperCase() === 'SELECT') {
			throw new TypeError(`Can not use SELECT query inside a transaction.`);
		} else {
			this.statements.push({
				sql: query,
				params: variables as any[]
			});
		}
	}

	private executeInsert(query: DB.QueryInsert, variables?: DB.Variables): void {
		this.statements.push(...convertQueryToSQL(query, this.database, variables));
	}

	private executeUpdate<T>(query: DB.QueryUpdate, variables?: DB.Variables): void {
		this.statements.push(...convertQueryToSQL(query, this.database, variables));
	}

	private executeDelete(query: DB.QueryDelete, variables?: DB.Variables): void {
		this.statements.push(...convertQueryToSQL(query, this.database, variables));
	}

	private executeCreateCollection(query: DB.QueryCreateCollection): void {
		this.statements.push(...convertQueryToSQL(query, this.database));
	}

	private executeAlterCollection(query: DB.QueryAlterCollection): void {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryAlterCollection to be from a collection.`);
		}

		if (!query.changes && !query.renamed) {
			throw new Error(`Expected QueryAlterCollection to contains at least 1 change.`);
		}

		this.pendingPromises.push(this.database.execute(q.describeCollection(collection)).then((description) => {
			const changes = List<DB.Change>(query.changes || []);

			const existingColumns = description.columns.filter(column => {
				return changes.findIndex(c => c !== undefined && c.type === 'dropColumn' && c.column === column.name) === -1;
			});

			const newColumns = changes.filter((change): change is DB.ChangeAddColumn => {
				return change !== undefined && change.type === 'addColumn';
			}).map((change: any) => change.column).toArray();

			const copyColumns = changes.filter(change => {
				return change !== undefined && change.type === 'addColumn' && change.copyColumn !== undefined;
			}).toArray() as DB.ChangeAddColumn[];

			const renameColumns = changes.reduce<{ [key: string]: DB.Column }>((columns, change) => {
				if (change && change.type === 'alterColumn') {
					columns![change.oldColumn] = change.newColumn;
				}
				return columns!;
			}, {} as { [key: string]: DB.Column });

			const tmpTable = `konstellio_db_rename_${++TransactionSQLite.tmpId}`;
			const create = q.createCollection(tmpTable).define(
				existingColumns.map(col => renameColumns[col.name!] ? renameColumns[col.name!] : col).concat(newColumns),
				[]
			);

			const finalCollection = query.renamed || collection;

			const insertColumns = existingColumns.map(col => {
				const source = col.name!;
				const renamed = renameColumns[source] ? renameColumns[source] : col;
				return {
					source,
					target: renamed.name!
				}
			}).concat(
				copyColumns.map(change => {
					return {
						target: change.column.name!,
						source: change.copyColumn!
					};
				})
			);

			this.execute(create);
			this.statements.push({
				sql: `INSERT INTO ${tmpTable} (${insertColumns.map(col => `"${col.target}"`).join(', ')}) SELECT ${insertColumns.map(col => `"${col.source}"`).join(', ')} FROM ${collectionToSQL(collection)}`,
				params: []
			});
			this.statements.push({
				sql: `DROP TABLE ${collectionToSQL(collection)}`,
				params: []
			});
			this.statements.push({
				sql: `ALTER TABLE ${tmpTable} RENAME TO ${collectionToSQL(finalCollection)}`,
				params: []
			});

			const existingIndexes = description.indexes.filter(index => {
				return changes.findIndex(c => c !== undefined && (index.type === DB.IndexType.Primary || (c.type === 'dropIndex' && c.index === index.name))) === -1;
			});

			const renamedIndexes = query.renamed
				? existingIndexes.map(index => new DB.Index(
					index.name.replace(`${collectionToString(collection)}_`, `${collectionToString(finalCollection)}_`),
					index.type,
					index.columns
				))
				: existingIndexes;

			const newIndexes = changes.filter((change): change is DB.ChangeAddIndex => {
				return change !== undefined && change.type === 'addIndex';
			}).map((change: any) => change.index).toArray();

			renamedIndexes.concat(newIndexes).forEach(index => {
				this.statements.push({
					sql: indexToSQL(finalCollection, index),
					params: []
				});
			});
		}));
	}

	private executeDropCollection(query: DB.QueryDropCollection): void {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryDropCollection to be from a collection.`);
		}

		this.statements.push({
			sql: `DROP TABLE ${collectionToSQL(collection)}`,
			params: []
		});
	}

	async commit(): Promise<DB.QueryCommitResult> {
		await Promise.all(this.pendingPromises);
		const driver = this.database.driver;
		const result = await new Promise<DB.QueryCommitResult>((resolve, reject) => driver.serialize(() => {
			driver.run('BEGIN');
			const errors: Error[] = [];
			this.statements.forEach(stmt => {
				driver.run(stmt.sql, stmt.params, (err) => {
					if (err) {
						errors.push(err);
					}
				});
			});
			driver.run('COMMIT', function (err) {
				if (err) {
					errors.push(err);
				}
				if (errors.length) {
					return reject(errors.pop()!);
				}
				resolve(new DB.QueryCommitResult(this.lastID.toString()));
			});
		}));
		this.statements = [];
		this.pendingPromises = [];
		return result;
	}

	async rollback(): Promise<void> {
		this.statements = [];
		this.pendingPromises = [];
	}
}

function runQuery(driver: SQLite, sql: string, params = [] as any[]): Promise<SQLiteQueryResult> {
	return new Promise((resolve, reject) => {
		driver.run(sql, params, function (err) {
			if (err) return reject(err);
			resolve({
				changes: this.changes,
				lastId: this.lastID.toString()
			});
		});
	});
}

function allQuery<T = any>(driver: SQLite, sql: string, params = [] as any[]): Promise<T[]> {
	return new Promise((resolve, reject) => {
		driver.all(sql, params, (err, results) => {
			if (err) return reject(err);
			resolve(results as T[]);
		});
	});
}

function collectionToString(collection: DB.Collection): string {
	return `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;
}

function collectionToSQL(collection: DB.Collection): string {
	return `"${collectionToString(collection)}"`;
}

function fieldToSQL(field: DB.Field | DB.FieldAs | DB.FieldDirection, params: any[], variables?: DB.Variables): string {
	if (field instanceof DB.Field) {
		return `"${field.alias ? `${field.alias}"."` : ''}${field.name}"`;
	}
	else if (field instanceof DB.FieldAs) {
		if (field.field instanceof DB.Function) {
			return `"${fnToSQL(field.field, params, variables)}" AS "${field.alias}"`;
		} else {
			return `"${field.field.toString()}" AS "${field.alias}"`;
		}
	}
	else {
		return `"${field.field.toString()}" ${field.direction.toUpperCase() || 'ASC'}`;
	}
}

function fnToSQL(field: DB.Function, params: any[], variables?: DB.Variables): string {
	return `${field.fn.toUpperCase()}(${field.args.map<string>(field => {
		return field ? (field instanceof DB.Field ? fieldToSQL(field, params, variables) : valueToSQL(field, params, variables)) : '';
	}).join(', ')})`;
}

function valueToSQL(field: DB.Value, params: any[], variables?: DB.Variables): string {
	if (field instanceof DB.Field) {
		return fieldToSQL(field, params, variables);
	}
	else if (field instanceof DB.Function) {
		return fnToSQL(field, params, variables);
	}
	else if (field instanceof DB.Variable) {
		if (variables === undefined || typeof variables[field.name] === 'undefined') {
			throw new Error(`Could not find query variable ${field.name}.`);
		}
		const value = variables[field.name];
		if (isArray(value)) {
			params.push(...value);
			return value.map(v => '?').join(', ');
		} else {
			params.push(value);
			return '?';
		}
	}
	else if (field) {
		params.push(field);
		return '?';
	}
	return '';
}

function comparisonToSQL(comparison: DB.Comparison, params: any[], variables?: DB.Variables): string {
	if (comparison instanceof DB.ComparisonIn) {
		return `${comparison.field instanceof DB.Field ? fieldToSQL(comparison.field, params, variables) : fnToSQL(comparison.field, params, variables)} IN (${comparison.args.map(arg => valueToSQL(arg!, params, variables)).join(', ')})`;
	}
	else {
		return `${comparison.field instanceof DB.Field ? fieldToSQL(comparison.field, params, variables) : fnToSQL(comparison.field, params, variables)} ${comparison.operator} ${valueToSQL(comparison.args.get(0), params, variables)}`;
	}
}

function binaryToSQL(bitwise: DB.Binary, params: any[], variables?: DB.Variables): string {
	if (bitwise.operands) {
		return `(${bitwise.operands.map<string>(op => {
			if (op instanceof DB.Comparison) {
				return comparisonToSQL(op, params, variables);
			}
			else if (op instanceof DB.Binary) {
				return binaryToSQL(op, params, variables);
			}
			return '';
		}).join(` ${bitwise.operator.toUpperCase()} `)})`;
	}
	else {
		return '';
	}
}

function selectQueryToSQL(query: DB.QuerySelect, database: DB.Database, variables?: DB.Variables): Statement {
	const params: any[] = [];
	let sql = ``;
	sql += `SELECT ${query.fields && query.fields.count() > 0 ? query.fields!.map<string>(f => f ? fieldToSQL(f, params, variables) : '').join(', ') : '*'}`;

	if (query.collection) {
		sql += ` FROM ${collectionToSQL(query.collection!)}`;
	} else {
		throw new Error(`Expected QuerySelect to be from a collection.`);
	}
	if (query.joins) {
		query.joins!.forEach((join, alias) => {
			const joinStm = convertQueryToSQL(join!.query, database, variables);
			params.push(...joinStm[0].params);
			sql += ` JOIN (${joinStm[0].sql}) AS ${alias} ON ${join!.on}`;
		});
	}
	if (query.conditions) {
		sql += ` WHERE ${binaryToSQL(query.conditions!, params, variables)}`;
	}
	if (query.sorts) {
		sql += ` ORDER BY ${query.sorts!.map<string>(sort => sort ? fieldToSQL(sort, params, variables) : '').join(', ')}`;
	}
	if (query.limit) {
		sql += ` LIMIT ${query.limit!}`;
	}
	if (query.offset) {
		sql += ` OFFSET ${query.offset!}`;
	}

	return {
		sql,
		params
	}
}

function indexToSQL(collection: DB.Collection, index: DB.Index): string {
	const cols = index.columns;
	if (!cols || cols.count() === 0) {
		throw new Error(`Expected index ${index.name} to contain at least 1 column.`);
	}
	let def = `CREATE `;
	if (index.type === DB.IndexType.Unique) {
		def += `UNIQUE `;
	}
	def += `INDEX ${index.name} ON ${collectionToSQL(collection)} (${cols.map<string>(col => col !== undefined ? fieldToSQL(col, []) : '').join(', ')})`;

	return def;
}

function columnType(type: DB.ColumnType) {
	switch (type) {
		case DB.ColumnType.Bit:
		case DB.ColumnType.Boolean:
		case DB.ColumnType.UInt:
		case DB.ColumnType.Int:
			return 'INTEGER';
		case DB.ColumnType.Float:
			return 'REAL';
		case DB.ColumnType.Blob:
			return 'BLOB';
		default:
			return 'TEXT';
	}
}

export type Statement = {
	sql: string
	params: any[]
}

export function convertQueryToSQL(query: DB.Query, database: DB.Database, variables?: DB.Variables): Statement[] {
	if (query instanceof DB.QuerySelect) {
		return [selectQueryToSQL(query, database, variables)]
	}
	else if (query instanceof DB.QueryUnion) {
		const params: any[] = [];
		let sql = ``;

		if (query.selects) {
			sql += `(${query.selects!.map<string>(subquery => {
				if (subquery) {
					const stmt = convertQueryToSQL(subquery, database, variables);
					params.push(...stmt[0].params);
					return stmt[0].sql;
				}
				throw new Error(`Expected a QuerySelect, got ${typeof subquery}.`);
			}).join(') UNION (')})`;
		} else {
			throw new Error(`Expected QueryUnion have at least 1 Select`);
		}
		if (query.sorts) {
			sql += ` ORDER BY ${query.sorts!.map<string>(sort => sort ? fieldToSQL(sort, params, variables) : '').join(', ')}`;
		}
		if (query.limit) {
			sql += ` LIMIT ${query.limit!}`;
		}
		if (query.offset) {
			sql += ` OFFSET ${query.offset!}`;
		}

		return [{ sql, params }];
	}
	else if (query instanceof DB.QueryAggregate) {
		const params: any[] = [];
		let sql = ``;
		sql += `SELECT ${query.fields && query.fields.count() > 0 ? query.fields!.map<string>(f => f ? fieldToSQL(f, params, variables) : '').join(', ') : '*'}`;

		if (query.collection) {
			sql += ` FROM ${collectionToSQL(query.collection!)}`;
		} else {
			throw new Error(`Expected QuerySelect to be from a collection.`);
		}
		if (query.joins) {
			query.joins!.forEach(join => {
				const joinStm = convertQueryToSQL(join!.query, database, variables);
				params.push(...joinStm[0].params);
				sql += ` JOIN (${joinStm[0].sql}) AS ${join!.alias} ON ${join!.on}`;
			});
		}
		if (query.conditions) {
			sql += ` WHERE ${binaryToSQL(query.conditions!, params, variables)}`;
		}
		if (query.groups) {
			sql += ` GROUP BY ${query.groups!.map<string>(field => field instanceof DB.Field ? fieldToSQL(field, params, variables) : fnToSQL(field!, params, variables)).join(', ')}`;
		}
		if (query.sorts) {
			sql += ` ORDER BY ${query.sorts!.map<string>(sort => sort ? fieldToSQL(sort, params, variables) : '').join(', ')}`;
		}
		if (query.limit) {
			sql += ` LIMIT ${query.limit!}`;
		}
		if (query.offset) {
			sql += ` OFFSET ${query.offset!}`;
		}

		return [{ sql, params }];
	}
	else if (query instanceof DB.QueryInsert) {
		const params: any[] = [];
		let sql = ``;

		if (query.collection) {
			sql += `INSERT INTO ${collectionToSQL(query.collection!)}`;
		} else {
			throw new Error(`Expected QueryInsert to be from a collection.`);
		}

		const objects = query.objects;
		if (objects !== undefined && objects.count() > 0) {
			sql += ` (${objects.get(0).map<string>((_, key) => `"${key}"`).join(', ')}) `;
			sql += `VALUES ${objects.map<string>(obj => {
				return `(${obj!.map<string>(value => {
					return valueToSQL(value as DB.Value, params, variables);
				}).join(', ')})`;
			}).join(', ')}`;
		} else {
			throw new Error(`Expected QueryInsert to have some data.`);
		}

		return [{ sql, params }];
	}
	else if (query instanceof DB.QueryUpdate) {
		const params: any[] = [];
		let sql = ``;

		if (query.collection) {
			sql += `UPDATE  ${collectionToSQL(query.collection!)} SET`;
		} else {
			throw new Error(`Expected QueryInsert to be from a collection.`);
		}
		if (query.object) {
			sql += ` ${query.object!.map<string>((value, key) => {
				return `"${key}" = ${valueToSQL(value as DB.Value, params, variables)}`;
			}).join(', ')}`;
		} else {
			throw new Error(`Expected QueryUpdate to have some data.`);
		}
		if (query.conditions) {
			sql += ` WHERE ${binaryToSQL(query.conditions!, params, variables)} `;
		}

		return [{ sql, params }];
	}
	else if (query instanceof DB.QueryDelete) {
		const params: any[] = [];
		let sql = ``;

		if (query.collection) {
			sql += `DELETE FROM  ${collectionToSQL(query.collection!)}`;
		} else {
			throw new Error(`Expected QueryDelete to be from a collection.`);
		}
		if (query.conditions) {
			sql += ` WHERE ${binaryToSQL(query.conditions!, params, variables)} `;
		}

		return [{ sql, params }];
	}
	else if (query instanceof DB.QueryCreateCollection) {
		const collection = query.collection;
		const columns = query.columns;
		const indexes = query.indexes;

		const params: any[] = [];
		let sql = '';

		if (collection) {
			sql += `CREATE TABLE ${collectionToSQL(query.collection!)}`;
		} else {
			throw new Error(`Expected QueryCreateCollection to be from a collection.`);
		}

		if (columns === undefined || columns!.count() === 0) {
			throw new Error(`Expected QueryCreateCollection to have at least one column, got none.`);
		}

		const autoCol = columns.filter(col => col !== undefined && col.autoIncrement);
		const primaryKeys = indexes ? indexes.filter(idx => idx !== undefined && idx.type === DB.IndexType.Primary) as List<DB.Index> : List<DB.Index>();
		const otherIndexes = indexes ? indexes.filter(idx => idx !== undefined && idx.type !== DB.IndexType.Primary) as List<DB.Index> : List<DB.Index>();

		// if (
		// 	autoCol.count() > 0 && (
		// 	primaryKeys.count() != 1 ||
		// 	primaryKeys.get(0).columns === undefined ||
		// 	primaryKeys.get(0).columns!.filter(col => col!.name === autoCol.get(0).name).count() === 0)
		// ) {
		// 	throw new Error(`Expected QueryCreateCollection to have a single autoincrement column with a corresponding primary index. ${autoCol.count()} ${primaryKeys.count()}`);
		// }
		if (primaryKeys.count() > 1) {
			throw new Error(`Expected QueryCreateCollection to have a single primary key index. This index can be on multiple columns.`);
		}

		const autoColName = autoCol && autoCol.count() > 0 && autoCol.get(0).name;

		sql += ` (${columns.map<string>(col => {
			if (col !== undefined) {
				const defaultValue = col.defaultValue;
				let def = `"${col.name}" ${columnType(col.type)}`;
				if (col.name === autoColName) {
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
			const cols = primaryKeys.get(0).columns;
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
	else {
		return [];
	}
}