import * as Query from './Query';
import * as Result from './QueryResult';
export declare enum Compare {
    Different = 0,
    Castable = 2
}
export interface Features {
    join: boolean;
}
export declare abstract class Database {
    abstract readonly features: Features;
    abstract connect(): Promise<Database>;
    abstract execute(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<any>;
    abstract execute<T>(query: Query.QuerySelect, variables?: Query.Variables): Promise<Result.QuerySelectResult<T>>;
    abstract execute<T>(query: Query.QueryAggregate, variables?: Query.Variables): Promise<Result.QueryAggregateResult<T>>;
    abstract execute<T>(query: Query.QueryUnion, variables?: Query.Variables): Promise<Result.QuerySelectResult<T>>;
    abstract execute<T>(query: Query.QueryUpdate, variables?: Query.Variables): Promise<Result.QueryUpdateResult<T>>;
    abstract execute(query: Query.QueryInsert, variables?: Query.Variables): Promise<Result.QueryInsertResult>;
    abstract execute(query: Query.QueryDelete, variables?: Query.Variables): Promise<Result.QueryDeleteResult>;
    abstract execute(query: Query.QueryShowCollection): Promise<Result.QueryShowCollectionResult>;
    abstract execute(query: Query.QueryCreateCollection): Promise<Result.QueryCreateCollectionResult>;
    abstract execute(query: Query.QueryDescribeCollection): Promise<Result.QueryDescribeCollectionResult>;
    abstract execute(query: Query.QueryAlterCollection): Promise<Result.QueryAlterCollectionResult>;
    abstract execute(query: Query.QueryCollectionExists): Promise<Result.QueryCollectionExistsResult>;
    abstract execute(query: Query.QueryDropCollection): Promise<Result.QueryDropCollectionResult>;
    abstract compareTypes(aType: Query.ColumnType, aSize: number, bType: Query.ColumnType, bSize: number): Compare;
}
