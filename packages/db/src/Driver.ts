import * as Query from './Query';
import * as Result from './QueryResult';

export enum Compare {
	Different = 0 << 0,
	Castable = 1 << 1
}

export abstract class Driver {

	abstract connect(): Promise<Driver>;

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
	abstract execute(query: Query.ShowCollectionQuery): Promise<Result.ShowCollectionQueryResult>;


	abstract compareTypes(a: Query.ColumnType, b: Query.ColumnType): Compare;
}