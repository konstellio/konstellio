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
import * as BigQuery from '@google-cloud/bigquery';
import { List } from 'immutable';

// https://googlecloudplatform.github.io/google-cloud-node/#/docs/google-cloud/v0.53.0/google-cloud#gcloud
export type BigQueryDriverConstructor = {
	projectId: string,
	keyFilename?: string,
	email?: string,
	credentials?: {
		client_email: string,
		private_key: string,
	},
	autoRetry?: boolean,
	maxRetries?: number
}

export class BigQueryDriver extends ADriver {

	driver: any

	constructor (options: BigQueryDriverConstructor) {
		super();

		this.driver = BigQuery(options);
	}

	connect(): Promise<ADriver> {
		return new Promise<ADriver>((resolve, reject) => {
			resolve(this);
		});
	}

	execute<T>(query: string): Promise<SelectQueryResult<T>>
	execute<T>(query: SelectQuery): Promise<SelectQueryResult<T>>
	execute<T>(query: AggregateQuery): Promise<AggregateQueryResult<T>>
	execute<T>(query: UnionQuery): Promise<SelectQueryResult<T>>
	execute<T>(query: InsertQuery): Promise<InsertQueryResult<T>>
	execute<T>(query: UpdateQuery): Promise<UpdateQueryResult<T>>
	execute<T>(query: ReplaceQuery): Promise<ReplaceQueryResult<T>>
	execute(query: DeleteQuery): Promise<DeleteQueryResult>
	execute<T>(query: any): Promise<any> {
		if (typeof query === 'string') {
			return this.executeString<T>(query);
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
			return Promise.reject(new QueryNotSupportedError(`BigQuery does not support InsertQuery.`));;
		}
		else if (query instanceof UpdateQuery) {
			return Promise.reject(new QueryNotSupportedError(`BigQuery does not support UpdateQuery.`));;
		}
		else if (query instanceof ReplaceQuery) {
			return Promise.reject(new QueryNotSupportedError(`BigQuery does not support ReplaceQuery.`));;
		}
		else if (query instanceof DeleteQuery) {
			return Promise.reject(new QueryNotSupportedError(`BigQuery does not support DeleteQuery.`));;
		}

		return Promise.reject(new TypeError(`Expected query to be a string, SelectQuery, AggregateQuery, InsertQuery, UpdateQuery, ReplaceQuery or DeleteQuery, got ${typeof query}.`));
	}

	private executeString<T> (query: string): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query}`));
		});
	}

	private executeSelect<T> (query: SelectQuery): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeUnion<T> (query: UnionQuery): Promise<SelectQueryResult<T>> {
		return new Promise<SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeAggregate<T> (query: AggregateQuery): Promise<AggregateQueryResult<T>> {
		return new Promise<AggregateQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

}