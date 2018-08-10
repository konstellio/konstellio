import { Driver, Compare, Features } from '../Driver';
import {
	QuerySelectResult,
	QueryAggregateResult,
	QueryDeleteResult,
	QueryInsertResult,
	QueryUpdateResult,
	QueryShowCollectionResult,
	QueryDescribeCollectionResult,
	QueryCreateCollectionResult,
	QueryAlterCollectionResult,
	QueryCollectionExistsResult,
	QueryDropCollectionResult
} from '../QueryResult';
import {
	q,
	Query,
	QuerySelect,
	QueryUnion,
	QueryAggregate,
	QueryInsert,
	QueryUpdate,
	QueryDelete,
	QueryShowCollection,
	QueryDescribeCollection,
	QueryCreateCollection,
	QueryAlterCollection,
	QueryCollectionExists,
	QueryDropCollection,
	Collection,
	Field,
	FieldDirection,
	FieldAs,
	Function,
	Variable,
	Variables,
	Column,
	ColumnType,
	Value,
	Index,
	IndexType,
	Comparison,
	Binary,
	ChangeAddColumn,
	ChangeAddIndex,
	ComparisonIn,
	Change
} from '../Query';
import { List } from 'immutable';
import { Database } from 'sqlite3';

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
				lastId: this.lastID.toString()
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
	readonly features: Features;

	options: SQLiteDriverConstructor
	driver!: Database

	constructor (options: SQLiteDriverConstructor) {
		super();
		this.options = options;
		this.features = {
			join: true
		}
	}

	connect(): Promise<SQLiteDriver> {
		return new Promise<SQLiteDriver>((resolve, reject) => {
			try {
				const { Database, OPEN_READWRITE, OPEN_CREATE } = require('sqlite3');
				this.driver = new Database(
					this.options.filename,
					this.options.mode || (OPEN_READWRITE | OPEN_CREATE),
					(err: Error) => {
						if (err) {
							return reject(err);
						}
						resolve(this);
					}
				);
			} catch (e) {
				throw new Error(`Could not load sqlite3 client. Maybe try "npm install sqlite3" ?`);
			}
		});
	}

	execute(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult>;
	execute<T>(query: QuerySelect, variables?: Variables): Promise<QuerySelectResult<T>>;
	execute<T>(query: QueryAggregate, variables?: Variables): Promise<QueryAggregateResult<T>>;
	execute<T>(query: QueryUnion, variables?: Variables): Promise<QuerySelectResult<T>>;
	execute<T>(query: QueryUpdate, variables?: Variables): Promise<QueryUpdateResult<T>>;
	execute(query: QueryInsert, variables?: Variables): Promise<QueryInsertResult>;
	execute(query: QueryDelete, variables?: Variables): Promise<QueryDeleteResult>;
	execute(query: QueryCreateCollection): Promise<QueryCreateCollectionResult>;
	execute(query: QueryDescribeCollection): Promise<QueryDescribeCollectionResult>;
	execute(query: QueryAlterCollection): Promise<QueryAlterCollectionResult>;
	execute(query: QueryCollectionExists): Promise<QueryCollectionExistsResult>;
	execute(query: QueryDropCollection): Promise<QueryDropCollectionResult>;
	execute(query: QueryShowCollection): Promise<QueryShowCollectionResult>;
	execute<T>(query: any, variables?: any): Promise<any> {
		if (typeof query === 'string') {
			return this.executeSQL(query, variables);
		}
		else if (query instanceof QuerySelect) {
			return this.executeSelect<T>(query, variables);
		}
		else if (query instanceof QueryAggregate) {
			return this.executeAggregate<T>(query, variables);
		}
		else if (query instanceof QueryUnion) {
			return this.executeUnion<T>(query, variables);
		}
		else if (query instanceof QueryInsert) {
			return this.executeInsert(query, variables);
		}
		else if (query instanceof QueryUpdate) {
			return this.executeUpdate<T>(query, variables);
		}
		else if (query instanceof QueryDelete) {
			return this.executeDelete(query, variables);
		}
		else if (query instanceof QueryDescribeCollection) {
			return this.executeDescribeCollection(query);
		}
		else if (query instanceof QueryCreateCollection) {
			return this.executeCreateCollection(query);
		}
		else if (query instanceof QueryAlterCollection) {
			return this.executeAlterCollection(query);
		}
		else if (query instanceof QueryCollectionExists) {
			return this.executeCollectionExists(query);
		}
		else if (query instanceof QueryDropCollection) {
			return this.executeDropCollection(query);
		}
		else if (query instanceof QueryShowCollection) {
			return this.executeShowCollection();
		}
		
		return Promise.reject(new TypeError(`Unsupported query, got ${typeof query}.`));
	}

	// @ts-ignore
	compareTypes(aType: ColumnType, aSize: number, bType: ColumnType, bSize: number): Compare {
		if (columnType(aType) === columnType(bType)) {
			return Compare.Castable;
		}
		return Compare.Different;
	}

	private async executeSQL(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult | QuerySelectResult<any>> {
		if (query.replace(/^[\s(]+/, '').substr(0, 5).toUpperCase() === 'SELECT') {
			return new QuerySelectResult<any>(await allQuery(this, query, variables));
		} else {
			return runQuery(this, query);
		}
	}

	private async executeSelect<T>(query: QuerySelect, variables?: Variables): Promise<QuerySelectResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const rows = await allQuery<T>(this, stmts[0].sql, stmts[0].params);
		return new QuerySelectResult<T>(rows);
	}

	private async executeAggregate<T>(query: QueryAggregate, variables?: Variables): Promise<QueryAggregateResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const rows = await allQuery<T>(this, stmts[0].sql, stmts[0].params);
		return new QuerySelectResult<T>(rows);
	}

	private async executeUnion<T>(query: QueryUnion, variables?: Variables): Promise<QuerySelectResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		const rows = await allQuery<T>(this, stmts[0].sql, stmts[0].params);
		return new QuerySelectResult<T>(rows);
	}

	private async executeInsert(query: QueryInsert, variables?: Variables): Promise<QueryInsertResult> {
		const stmts = convertQueryToSQL(query, variables);
		const { lastId } = await runQuery(this, stmts[0].sql, stmts[0].params);
		return new QueryInsertResult(lastId.toString());
	}

	private async executeUpdate<T>(query: QueryUpdate, variables?: Variables): Promise<QueryUpdateResult<T>> {
		const stmts = convertQueryToSQL(query, variables);
		await runQuery(this, stmts[0].sql, stmts[0].params);
		const fields = query.object;
		const data: T = fields ? fields.toJS() : {}
		return new QueryUpdateResult<T>(data);
	}

	private async executeDelete(query: QueryDelete, variables?: Variables): Promise<QueryDeleteResult> {
		const stmts = convertQueryToSQL(query, variables);
		const { changes } = await runQuery(this, stmts[0].sql, stmts[0].params);
		return new QueryDeleteResult(changes > 0);
	}

	private async executeShowCollection(): Promise<QueryShowCollectionResult> {
		return allQuery<{ name: string }>(this, `SELECT name FROM sqlite_master WHERE type="table"`).then((tables) => {
			return new QueryShowCollectionResult(tables.filter(({ name }) => name !== 'sqlite_sequence').map<Collection>(({ name }) => {
				const match = name.match(/^([^_]+)_(.*)$/);
				if (match) {
					return q.collection(match[2], match[1]);
				}
				return q.collection(name);
			}));
		});
	}

	private async executeDescribeCollection(query: QueryDescribeCollection): Promise<QueryDescribeCollectionResult> {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryDescribeCollection to be from a collection.`);
		}

		const table_name = collectionToSQL(query.collection!);

		const [colDefs, idxDefs, auto] = await Promise.all([
			allQuery(this, `PRAGMA table_info(${table_name})`, [])
				.catch(() => [] as any[]),
			allQuery(this, `PRAGMA index_list(${table_name})`, [])
				.then(indexes => Promise.all(indexes.map(index => allQuery(this, `PRAGMA index_xinfo(${index.name})`, []).then(columns => ({
					name: index.name as string,
					type: index.unique!! ? 'unique' : 'index',
					columns: columns || []
				})))))
				.then(indexes => indexes.filter(idx => idx.name.substr(0, 17) !== 'sqlite_autoindex_'))
				.catch(() => [] as {name: string, type: string, columns: any[]}[]),
			allQuery(this, `SELECT "auto" FROM sqlite_master WHERE tbl_name=? AND sql LIKE "%AUTOINCREMENT%"`, [table_name])
				.then(rows => rows.length > 0)
				.catch(() => false)
		]);
		
		const columns = colDefs.map<Column>(col => {
			let type: ColumnType = ColumnType.Text;
			let size: number = -1;
			switch (col.type) {
				case 'TEXT': break;
				case 'INTEGER': type = ColumnType.Int; size = 64; break;
				case 'REAL':
				case 'NUMERIC': type = ColumnType.Float; size = 64; break;
				case 'BLOB': type = ColumnType.Blob; break;
			}
			return new Column(col.name, type, size, col.dflt_value, col.pk!! ? auto : false);
		});

		const indexes = idxDefs.map<Index>(idx => {
			let type: IndexType = IndexType.Index;
			switch (idx.type) {
				case 'unique': type = IndexType.Unique; break;
			}
			const cols = idx.columns.filter(col => col.cid > -1).sort((a, b) => a.seqno - b.seqno);
			const columns = List<FieldDirection>(cols.map(col => {
				return new FieldDirection(q.field(col.name), col.desc!! ? 'desc' : 'asc');
			}));
			return new Index(idx.name, type, columns);
		});

		const primaryKeys = colDefs.filter(col => col.pk!!).map(col => q.index(`${table_name}_${col.name}`, IndexType.Primary, [q.sort(col.name, 'asc')]));

		return new QueryDescribeCollectionResult(
			collection,
			columns,
			primaryKeys.concat(indexes)
		);
	}

	private executeCreateCollection(query: QueryCreateCollection): Promise<QueryCreateCollectionResult> {
		return new Promise<QueryCreateCollectionResult>((resolve, reject) => {
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
				const result = new QueryCreateCollectionResult(true);
				resolve(result);
			})
			.catch(reject);
		});
	}

	private static tmpId: number = 0;

	private async executeAlterCollection(query: QueryAlterCollection): Promise<QueryAlterCollectionResult> {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryAlterCollection to be from a collection.`);
		}

		if (!query.changes && !query.renamed) {
			throw new Error(`Expected QueryAlterCollection to contains at least 1 change.`);
		}
		
		const changes = List<Change>(query.changes || []);

		const description = await this.executeDescribeCollection(q.describeCollection(collection));

		const existingColumns = description.columns.filter(column => {
			return changes.findIndex(c => c !== undefined && c.type === 'dropColumn' && c.column === column.name) === -1;
		});

		const newColumns = changes.filter((change): change is ChangeAddColumn => {
			return change !== undefined && change.type === 'addColumn';
		}).map((change: any) => change.column).toArray();

		const copyColumns = changes.filter(change => {
			return change !== undefined && change.type === 'addColumn' && change.copyColumn !== undefined;
		}).toArray() as ChangeAddColumn[];

		const renameColumns = changes.reduce<{ [key: string]: Column}>((columns, change) => {
			if (change && change.type === 'alterColumn') {
				columns![change.oldColumn] = change.newColumn;
			}
			return columns!;
		}, {} as { [key: string]: Column});

		const tmpTable = `konstellio_db_rename_${++SQLiteDriver.tmpId}`;
		const create = q.createCollection(tmpTable).define(
			existingColumns.map(col => renameColumns[col.name!] ? renameColumns[col.name!] : col).concat(newColumns),
			[]
		);
		
		const finalCollection = query.renamed || collection;

		const insertColumns = existingColumns.map(col => {
			const source = col.name!;
			const renamed = renameColumns[source] ? renameColumns[source] : col;
			return {
				target: renamed.name!,
				source: source
			}
		}).concat(
			copyColumns.map(change => {
				return {
					target: change.column.name!,
					source: change.copyColumn!
				};
			})
		);

		await this.executeCreateCollection(create);
		await runQuery(this, `INSERT INTO ${tmpTable} (${insertColumns.map(col => `"${col.target}"`).join(', ')}) SELECT ${insertColumns.map(col => `"${col.source}"`).join(', ')} FROM ${collectionToSQL(collection)}`, []);
		await runQuery(this, `DROP TABLE ${collectionToSQL(collection)}`, []);
		await runQuery(this, `ALTER TABLE ${tmpTable} RENAME TO ${collectionToSQL(finalCollection)}`, []);

		const existingIndexes = description.indexes.filter(index => {
			return changes.findIndex(c => c !== undefined && (index.type === IndexType.Primary || (c.type === 'dropIndex' && c.index === index.name))) === -1;
		});

		const renamedIndexes = query.renamed
			? existingIndexes.map(index => new Index(
				index.name.replace(`${collectionToString(collection)}_`, `${collectionToString(finalCollection)}_`),
				index.type,
				index.columns
			))
			: existingIndexes;

		const newIndexes = changes.filter((change): change is ChangeAddIndex => {
			return change !== undefined && change.type === 'addIndex';
		}).map((change: any) => change.index).toArray();

		await Promise.all(renamedIndexes.concat(newIndexes).map(index => runQuery(this, indexToSQL(finalCollection, index))));

		return new QueryAlterCollectionResult(true);
	}

	private async executeCollectionExists(query: QueryCollectionExists): Promise<QueryCollectionExistsResult> {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryCollectionExists to be from a collection.`);
		}

		try {
			const info = await allQuery(this, `PRAGMA table_info(${collectionToSQL(collection)})`, []);
			return new QueryCollectionExistsResult(info.length > 0);
		} catch (e) {
			return new QueryCollectionExistsResult(false);
		}
	}

	private async executeDropCollection(query: QueryDropCollection): Promise<QueryDropCollectionResult> {
		const collection = query.collection;
		if (!collection) {
			throw new Error(`Expected QueryDropCollection to be from a collection.`);
		}

		try {
			await runQuery(this, `DROP TABLE ${collectionToSQL(collection)}`, []);
			return new QueryDropCollectionResult(true);
		} catch (e) {
			return new QueryDropCollectionResult(false);
		}
	}
}

function collectionToString(collection: Collection): string {
	return `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;
}

function collectionToSQL(collection: Collection): string {
	return `"${collectionToString(collection)}"`;
}

function fieldToSQL(field: Field | FieldAs | FieldDirection, params: any[], variables?: Variables): string {
	if (field instanceof Field) {
		return `"${field.alias ? `${field.alias}.` : ''}${field.name}"`;
	}
	else if (field instanceof FieldAs) {
		if (field.field instanceof Function) {
			return `"${fnToSQL(field.field, params, variables)}" AS "${field.alias}"`;
		} else {
			return `"${field.field.toString()}" AS "${field.alias}"`;
		}
	}
	else {
		return `"${field.field.toString()}" ${field.direction.toUpperCase() || 'ASC'}`;
	}
}

function fnToSQL(field: Function, params: any[], variables?: Variables): string {
	return `${field.fn.toUpperCase()}(${field.args.map<string>(field => {
		return field ? (field instanceof Field ? fieldToSQL(field, params, variables) : valueToSQL(field, params, variables)) : '';
	}).join(', ')})`;
}

function valueToSQL(field: Value, params: any[], variables?: Variables): string {
	if (field instanceof Field) {
		return fieldToSQL(field, params, variables);
	}
	else if (field instanceof Function) {
		return fnToSQL(field, params, variables);
	}
	else if (field instanceof Variable) {
		if (variables === undefined || typeof variables[field.name] === 'undefined') {
			throw new Error(`Could not find query variable ${field.name}.`);
		}
		params.push(variables[field.name]);
		return '?';
	}
	else if (field) {
		params.push(field);
		return '?';
	}
	return '';
}

function comparisonToSQL(comparison: Comparison, params: any[], variables?: Variables): string {
	if (comparison instanceof ComparisonIn) {
		return `${comparison.field instanceof Field ? fieldToSQL(comparison.field, params, variables) : fnToSQL(comparison.field, params, variables)} IN (${comparison.args.map(arg => valueToSQL(arg!, params, variables)).join(', ')})`;
	}
	else {
		return `${comparison.field instanceof Field ? fieldToSQL(comparison.field, params, variables) : fnToSQL(comparison.field, params, variables)} ${comparison.operator} ${valueToSQL(comparison.args.get(0), params, variables)}`;
	}
}

function binaryToSQL(bitwise: Binary, params: any[], variables?: Variables): string {
	if (bitwise.operands) {
		return `(${bitwise.operands.map<string>(op => {
			if (op instanceof Comparison) {
				return comparisonToSQL(op, params, variables);
			}
			else if (op instanceof Binary) {
				return binaryToSQL(op, params, variables);
			}
			return '';
		}).join(` ${bitwise.operator.toUpperCase()} `)})`;
	}
	else {
		return '';
	}
}

function selectQueryToSQL(query: QuerySelect, variables?: Variables): Statement {
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
			const joinStm = convertQueryToSQL(join!.query, variables);
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

function indexToSQL(collection: Collection, index: Index): string {
	const cols = index.columns;
	if (!cols || cols.count() === 0) {
		throw new Error(`Expected index ${index.name} to contain at least 1 column.`);
	}
	let def = `CREATE `;
	if (index.type === IndexType.Unique) {
		def += `UNIQUE `;
	}
	def += `INDEX ${index.name} ON ${collectionToSQL(collection)} (${cols.map<string>(col => col !== undefined ? fieldToSQL(col, []) : '').join(', ')})`;

	return def;
}

function columnType(type: ColumnType) {
	switch (type) {
		case ColumnType.Bit:
		case ColumnType.Boolean:
		case ColumnType.UInt:
		case ColumnType.Int:
			return 'INTEGER';
		case ColumnType.Float:
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
	if (query instanceof QuerySelect) {
		return [selectQueryToSQL(query, variables)]
	}
	else if (query instanceof QueryUnion) {
		const params: any[] = [];
		let sql = ``;

		if (query.selects) {
			sql += `(${query.selects!.map<string>(subquery => {
				if (subquery) {
					const stmt = convertQueryToSQL(subquery, variables);
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
	else if (query instanceof QueryAggregate) {
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
				const joinStm = convertQueryToSQL(join!.query, variables);
				params.push(...joinStm[0].params);
				sql += ` JOIN (${joinStm[0].sql}) AS ${join!.alias} ON ${join!.on}`;
			});
		}
		if (query.conditions) {
			sql += ` WHERE ${binaryToSQL(query.conditions!, params, variables)}`;
		}
		if (query.groups) {
			sql += ` GROUP BY ${query.groups!.map<string>(field => field instanceof Field ? fieldToSQL(field, params, variables) : fnToSQL(field!, params, variables)).join(', ')}`;
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
	else if (query instanceof QueryInsert) {
		const params: any[] = [];
		let sql = ``;

		if (query.collection) {
			sql += `INSERT INTO ${collectionToSQL(query.collection!)}`;
		} else {
			throw new Error(`Expected QueryInsert to be from a collection.`);
		}

		const objects = query.objects;
		if (objects !== undefined && objects.count() > 0) {
			sql += `(${objects.get(0).map<string>((_, key) => `"${key}"`).join(', ')}) `;
			sql += `VALUES ${objects.map<string>(obj => {
				return `(${obj!.map<string>(value => {
					params.push(value);
					return '?';
				}).join(', ')})`;
			}).join(', ')}`;
		} else {
			throw new Error(`Expected QueryInsert to have some data.`);
		}

		return [{ sql, params }];
	}
	else if (query instanceof QueryUpdate) {
		const params: any[] = [];
		let sql = ``;

		if (query.collection) {
			sql += `UPDATE  ${collectionToSQL(query.collection!)} SET`;
		} else {
			throw new Error(`Expected QueryInsert to be from a collection.`);
		}
		if (query.object) {
			sql += ` ${query.object!.map<string>((value, key) => {
				params.push(value);
				return `"${key}" = ?`;
			}).join(', ')}`;
		} else {
			throw new Error(`Expected QueryUpdate to have some data.`);
		}
		if (query.conditions) {
			sql += ` WHERE ${binaryToSQL(query.conditions!, params, variables)} `;
		}

		return [{ sql, params }];
	}
	else if (query instanceof QueryDelete) {
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
	else if (query instanceof QueryCreateCollection) {
		const collection = query.collection;
		const columns = query.columns;
		const indexes = query.indexes;

		let params: any[] = [];
		let sql = '';

		if (collection) {
			sql += `CREATE TABLE ${collectionToSQL(query.collection!)}`;
		} else {
			throw new Error(`Expected QueryCreateCollection to be from a collection.`);
		}

		if (columns === undefined || columns!.count() === 0) {
			throw new Error(`Expected QueryCreateCollection to have at least one column, got none.`);
		}

		const autoCol = columns.filter(col => col !== undefined && col.autoIncrement === true);
		const primaryKeys = indexes ? indexes.filter(idx => idx !== undefined && idx.type === IndexType.Primary) as List<Index> : List<Index>();
		const otherIndexes = indexes ? indexes.filter(idx => idx !== undefined && idx.type !== IndexType.Primary) as List<Index> : List<Index>();

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