import { SelectQuery, AggregateQuery, UnionQuery, InsertQuery, UpdateQuery, ReplaceQuery, DeleteQuery } from './Query';
import { SelectQueryResult, AggregateQueryResult, InsertQueryResult, UpdateQueryResult, ReplaceQueryResult, DeleteQueryResult } from './QueryResult';

export abstract class ADriver {

	abstract connect(): Promise<ADriver>;

	abstract execute<T>(query: string): Promise<SelectQueryResult<T>>;
	abstract execute<T>(query: SelectQuery): Promise<SelectQueryResult<T>>;
	abstract execute<T>(query: AggregateQuery): Promise<AggregateQueryResult<T>>;
	abstract execute<T>(query: UnionQuery): Promise<SelectQueryResult<T>>;
	abstract execute<T>(query: InsertQuery): Promise<InsertQueryResult<T>>;
	abstract execute<T>(query: UpdateQuery): Promise<UpdateQueryResult<T>>;
	abstract execute<T>(query: ReplaceQuery): Promise<ReplaceQueryResult<T>>;
	abstract execute(query: DeleteQuery): Promise<DeleteQueryResult>;

}