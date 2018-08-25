import * as Query from './Query';

export class QueryResult {

}

export class QuerySelectResult<T> extends QueryResult {
	constructor(public readonly results: T[]) {
		super();
	}
}

export class QueryAggregateResult<T> extends QueryResult {
	constructor(public readonly results: T[]) {
		super();
	}
}

export class QueryCommitResult extends QueryResult {
	constructor(public readonly lastId: string) {
		super();
	}
}

export class QueryShowCollectionResult extends QueryResult {
	constructor(public readonly collections: Query.Collection[]) {
		super();
	}
}

export class QueryDescribeCollectionResult extends QueryResult {
	constructor(public readonly collection: Query.Collection, public readonly columns: Query.Column[], public readonly indexes: Query.Index[]) {
		super();
	}
}

export class QueryCollectionExistsResult extends QueryResult {
	constructor(public readonly exists: boolean) {
		super();
	}
}