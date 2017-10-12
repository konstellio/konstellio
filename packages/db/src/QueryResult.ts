import * as Query from './Query';

export class QueryResult {

}

export class SelectQueryResult<T> extends QueryResult {
	public readonly results: T[]

	constructor (results: T[]) {
		super();
		this.results = results;
	}
}

export class AggregateQueryResult<T> extends QueryResult {
	public readonly results: T[]

	constructor (results: T[]) {
		super();
		this.results = results;
	}
}

export class InsertQueryResult<T> extends QueryResult {
	public readonly id: string
	public readonly data: T

	constructor (id: string, data: T) {
		super();
		this.id = id;
		this.data = data;
	}
}

export class UpdateQueryResult<T> extends QueryResult {
	public readonly data: T

	constructor (data: T) {
		super();
		this.data = data;
	}
}

export class ReplaceQueryResult<T> extends QueryResult {
	public readonly data: T

	constructor (data: T) {
		super();
		this.data = data;
	}
}

export class DeleteQueryResult extends QueryResult {
	public readonly acknowledge: boolean

	constructor (acknowledge: boolean) {
		super();
		this.acknowledge = acknowledge;
	}
}

export class CreateCollectionQueryResult extends QueryResult {
	public readonly acknowledge: boolean

	constructor (acknowledge: boolean) {
		super();
		this.acknowledge = acknowledge;
	}
}

export class AlterCollectionQueryResult extends QueryResult {
	public readonly acknowledge: boolean

	constructor (acknowledge: boolean) {
		super();
		this.acknowledge = acknowledge;
	}
}

export class DescribeCollectionQueryResult extends QueryResult {
	public readonly columns: Query.Column[]
	public readonly indexes: Query.Index[]

	constructor (columns: Query.Column[], indexes: Query.Index[]) {
		super();
		this.columns = columns;
		this.indexes = indexes;
	}
}

export class CollectionExistsQueryResult extends QueryResult {
	public readonly exists: boolean

	constructor (exists: boolean) {
		super();
		this.exists = exists;
	}
}

export class DropCollectionQueryResult extends QueryResult {
	public readonly acknowledge: boolean

	constructor (acknowledge: boolean) {
		super();
		this.acknowledge = acknowledge;
	}
}

export class CreateIndexQueryResult extends QueryResult {
	public readonly acknowledge: boolean

	constructor (acknowledge: boolean) {
		super();
		this.acknowledge = acknowledge;
	}
}

export class DropIndexQueryResult extends QueryResult {
	public readonly acknowledge: boolean

	constructor (acknowledge: boolean) {
		super();
		this.acknowledge = acknowledge;
	}
}