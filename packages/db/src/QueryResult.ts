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