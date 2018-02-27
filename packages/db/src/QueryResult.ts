import * as Query from './Query';

export class QueryResult {

}

export class SelectQueryResult<T> extends QueryResult {
	constructor(public readonly results: T[]) {
		super();
	}
}

export class AggregateQueryResult<T> extends QueryResult {
	constructor(public readonly results: T[]) {
		super();
	}
}

export class InsertQueryResult extends QueryResult {
	constructor(public readonly id: string) {
		super();
	}
}

export class UpdateQueryResult<T> extends QueryResult {
	constructor(public readonly data: T) {
		super();
	}
}

export class ReplaceQueryResult<T> extends QueryResult {
	constructor(public readonly data: T) {
		super();
	}
}

export class DeleteQueryResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}

export class CreateCollectionQueryResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}

export class AlterCollectionQueryResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}

export class ShowCollectionQueryResult extends QueryResult {
	constructor(public readonly collections: Query.Collection[]) {
		super();
	}
}

export class DescribeCollectionQueryResult extends QueryResult {
	constructor(public readonly collection: Query.Collection, public readonly columns: Query.Column[], public readonly indexes: Query.Index[]) {
		super();
	}
}

export class CollectionExistsQueryResult extends QueryResult {
	constructor(public readonly exists: boolean) {
		super();
	}
}

export class DropCollectionQueryResult extends QueryResult {
	constructor(public readonly acknowledge: boolean) {
		super();
	}
}