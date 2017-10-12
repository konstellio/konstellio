import * as Query from './Query';
import * as Result from './QueryResult';

export abstract class ADriver {

	abstract connect(): Promise<ADriver>;

	abstract execute(query: string): Promise<any>;
	abstract execute<T>(query: Query.SelectQuery): Promise<Result.SelectQueryResult<T>>;
	abstract execute<T>(query: Query.AggregateQuery): Promise<Result.AggregateQueryResult<T>>;
	abstract execute<T>(query: Query.UnionQuery): Promise<Result.SelectQueryResult<T>>;
	abstract execute<T>(query: Query.InsertQuery): Promise<Result.InsertQueryResult<T>>;
	abstract execute<T>(query: Query.UpdateQuery): Promise<Result.UpdateQueryResult<T>>;
	abstract execute<T>(query: Query.ReplaceQuery): Promise<Result.ReplaceQueryResult<T>>;
	abstract execute(query: Query.DeleteQuery): Promise<Result.DeleteQueryResult>;
	abstract execute(query: Query.CreateCollectionQuery): Promise<Result.CreateCollectionQueryResult>;
	abstract execute(query: Query.DescribeCollectionQuery): Promise<Result.DescribeCollectionQueryResult>;
	abstract execute(query: Query.AlterCollectionQuery): Promise<Result.AlterCollectionQueryResult>;
	abstract execute(query: Query.CollectionExistsQuery): Promise<Result.CollectionExistsQueryResult>;
	abstract execute(query: Query.DropCollectionQuery): Promise<Result.DropCollectionQueryResult>;
	abstract execute(query: Query.CreateIndexQuery): Promise<Result.CreateIndexQueryResult>;
	abstract execute(query: Query.DropIndexQuery): Promise<Result.DropIndexQueryResult>;

}