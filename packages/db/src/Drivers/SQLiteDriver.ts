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
	execute<T>(query: SelectQuery): Promise<SelectQueryResult<T>>
	execute<T>(query: AggregateQuery): Promise<AggregateQueryResult<T>>
	execute<T>(query: UnionQuery): Promise<SelectQueryResult<T>>
	execute<T>(query: InsertQuery): Promise<InsertQueryResult<T>>
	execute<T>(query: UpdateQuery): Promise<UpdateQueryResult<T>>
	execute<T>(query: ReplaceQuery): Promise<ReplaceQueryResult<T>>
	execute(query: DeleteQuery): Promise<DeleteQueryResult>
	execute<T>(query: any): Promise<any> {
		if (typeof query === 'string') {
			return this.executeSQL(query);
		}
		else if (query instanceof SelectQuery) {
			return this.executeSelect<T>(query);
		}
		else if (query instanceof AggregateQuery) {
			return this.executeAggregate<T>(query);
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

	private executeSQL (query: string): Promise<SQLiteQueryResult> {
		return new Promise<SQLiteQueryResult>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://github.com/mapbox/node-sqlite3/wiki/API#databaserunsql-param--callback
			this.driver.run(query, function (err) {
				if (err) {
					return reject(err);
				}

				const result: SQLiteQueryResult = {
					lastId: this.lastId,
					changes: this.changes
				};

				return resolve(result);
			})
		});
	}

	private executeSelect<T> (query: SelectQuery): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_select.html
			reject(new Error(`Not implemented.`));
		});
	}

	private executeAggregate<T> (query: AggregateQuery): Promise<AggregateQueryResult<T>> {
		return new Promise<AggregateQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_aggfunc.html
			reject(new Error(`Not implemented.`));
		});
	}

	private executeUnion<T> (query: UnionQuery): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_select.html#x1326
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeInsert<T> (query: InsertQuery): Promise<InsertQueryResult<T>> {
		return new Promise<InsertQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_insert.html

			const collection = query.collection();
			if (!collection) {
				return reject(new QuerySyntaxError(`InsertQuery needs a collection.`));
			}

			const fields = query.fields()
			const data = fields ? fields.toJS() : {};

			reject(new Error(`Not implemented.`));
		});
	}

	private executeUpdate<T> (query: UpdateQuery): Promise<UpdateQueryResult<T>> {
		return new Promise<UpdateQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_update.html
			reject(new Error(`Not implemented.`));
		});
	}

	private executeReplace<T> (query: ReplaceQuery): Promise<ReplaceQueryResult<T>> {
		return new Promise<ReplaceQueryResult<T>>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_replace.html
			reject(new Error(`Not implemented.`));
		});
	}

	private executeDelete (query: DeleteQuery): Promise<DeleteQueryResult> {
		return new Promise<DeleteQueryResult>((resolve, reject) => {
			// https://sqlite.org/lang_transaction.html
			// https://sqlite.org/lang_delete.html
			reject(new Error(`Not implemented.`));
		});
	}
}