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

export class QueryInsertResult extends QueryResult {
	constructor(public readonly id: string) {
		super();
	}
}

export class QueryUpdateResult<T> extends QueryResult {
	constructor(public readonly data: T) {
		super();
	}
}

export class QueryDeleteResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}

export class QueryCreateCollectionResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}

export class QueryAlterCollectionResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
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

export class QueryDropCollectionResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}