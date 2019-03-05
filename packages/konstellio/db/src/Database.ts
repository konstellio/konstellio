import { EventEmitter } from '@konstellio/eventemitter';
import * as Query from './Query';
import * as Result from './QueryResult';

export enum Compare {
	Different = 0 << 0,
	Castable = 1 << 1
}

export interface Features {
	join: boolean;
}

export abstract class Database {
	abstract readonly features: Features;

	abstract connect(): Promise<Database>;
	abstract disconnect(): Promise<void>;

	abstract execute(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<any>;
	abstract execute<T>(query: Query.QuerySelect, variables?: Query.Variables): Promise<Result.QuerySelectResult<T>>;
	abstract execute<T>(query: Query.QueryAggregate, variables?: Query.Variables): Promise<Result.QueryAggregateResult<T>>;
	abstract execute<T>(query: Query.QueryUnion, variables?: Query.Variables): Promise<Result.QuerySelectResult<T>>;
	abstract execute(query: Query.QueryShowCollection): Promise<Result.QueryShowCollectionResult>;
	abstract execute(query: Query.QueryDescribeCollection): Promise<Result.QueryDescribeCollectionResult>;
	abstract execute(query: Query.QueryCollectionExists): Promise<Result.QueryCollectionExistsResult>;

	abstract transaction(): Promise<Transaction>;

	abstract compareTypes(aType: Query.ColumnType, aSize: number, bType: Query.ColumnType, bSize: number): Compare;
}

export abstract class Transaction extends EventEmitter {
	abstract execute(query: string, variables?: (string | number | boolean | Date | null)[]): void;
	abstract execute(query: Query.QueryInsert, variables?: Query.Variables): void;
	abstract execute(query: Query.QueryUpdate, variables?: Query.Variables): void;
	abstract execute(query: Query.QueryDelete, variables?: Query.Variables): void;
	abstract execute(query: Query.QueryCreateCollection): void;
	abstract execute(query: Query.QueryAlterCollection): void;
	abstract execute(query: Query.QueryDropCollection): void;

	abstract commit(): Promise<Result.QueryCommitResult>;
	abstract rollback(): Promise<void>;
}