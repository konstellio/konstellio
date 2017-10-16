import { Driver } from '../Driver';
import * as QueryResult from '../QueryResult';
import * as Query from '../Query';
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

export class BigQueryDriver extends Driver {

	driver: any

	constructor (options: BigQueryDriverConstructor) {
		super();

		this.driver = BigQuery(options);
	}

	connect(): Promise<Driver> {
		return new Promise<Driver>((resolve, reject) => {
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
			return this.executeString<T>(query);
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
			return Promise.reject(new Query.QueryNotSupportedError(`BigQuery does not support InsertQuery.`));
		}
		else if (query instanceof Query.UpdateQuery) {
			return Promise.reject(new Query.QueryNotSupportedError(`BigQuery does not support UpdateQuery.`));
		}
		else if (query instanceof Query.ReplaceQuery) {
			return Promise.reject(new Query.QueryNotSupportedError(`BigQuery does not support ReplaceQuery.`));
		}
		else if (query instanceof Query.DeleteQuery) {
			return Promise.reject(new Query.QueryNotSupportedError(`BigQuery does not support DeleteQuery.`));
		}

		return Promise.reject(new TypeError(`Expected query to be a string, SelectQuery, AggregateQuery, InsertQuery, UpdateQuery, ReplaceQuery or DeleteQuery, got ${typeof query}.`));
	}

	private executeString<T> (query: string): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query}`));
		});
	}

	private executeSelect<T> (query: Query.SelectQuery): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeUnion<T> (query: Query.UnionQuery): Promise<QueryResult.SelectQueryResult<T>> {
		return new Promise<QueryResult.SelectQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

	private executeAggregate<T> (query: Query.AggregateQuery): Promise<QueryResult.AggregateQueryResult<T>> {
		return new Promise<QueryResult.AggregateQueryResult<T>>((resolve, reject) => {
			reject(new Error(`Not implemented : ${query.toString()}`));
		});
	}

}