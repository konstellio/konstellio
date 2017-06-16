import * as assert from 'assert';
import { Map, List, Record } from 'immutable';

export class q {

	public static select (...fields: FieldExpression[]) {
		if (fields.length > 0) {
			return new SelectQuery().select(...fields);
		}
		return new SelectQuery();
	}

	public static aggregate (fields: { [alias: string]: CalcField }) {
		return new AggregateQuery().select(fields);
	}

	public static union (...selects: SelectQuery[]) {
		return new UnionQuery(List<SelectQuery>(selects));
	}

	public static insert (name: string, namespace?: string) {
		return new InsertQuery().collection(name, namespace);
	}

	public static update (name: string, namespace?: string) {
		return new UpdateQuery().collection(name, namespace);
	}

	public static replace (name: string, namespace?: string) {
		return new ReplaceQuery().collection(name, namespace);
	}

	public static delete (name: string, namespace?: string) {
		return new DeleteQuery().collection(name, namespace);
	}


	public static and (...queries: Expression[]): Bitwise {
		return new Bitwise("and", queries);
	}

	public static or (...queries: Expression[]): Bitwise {
		return new Bitwise("or", queries);
	}

	public static xor (...queries: Expression[]): Bitwise {
		return new Bitwise("xor", queries);
	}


	public static eq (field: FieldExpression, value: ValueExpression) {
		return new ComparisonEqual(field, value);
	}

	public static ne (field: FieldExpression, value: ValueExpression) {
		return new ComparisonNotEqual(field, value);
	}

	public static gt (field: FieldExpression, value: ValueExpression) {
		return new ComparisonGreaterThan(field, value);
	}

	public static gte (field: FieldExpression, value: ValueExpression) {
		return new ComparisonGreaterThanOrEqual(field, value);
	}

	public static lt (field: FieldExpression, value: ValueExpression) {
		return new ComparisonLesserThan(field, value);
	}

	public static lte (field: FieldExpression, value: ValueExpression) {
		return new ComparisonLesserThanOrEqual(field, value);
	}

	public static in (field: FieldExpression, values: ValueExpression[]) {
		return new ComparisonIn(field, values);
	}

	public static beginsWith (field: FieldExpression, value: string) {
		return new ComparisonBeginsWith(field, value);
	}


	public static collection (name: string, namespace?: string) {
		return new Collection(name, namespace);
	}

	public static field (name: string) {
		return new Field(name);
	}

	public static sort (name: string, direction?: DirectionExpression) {
		return new SortableField(name, direction);
	}

	// https://dev.mysql.com/doc/refman/5.7/en/group-by-functions.html

	
	public static count (field: FieldExpression) {
		return new CountCalcField(field);
	}

	public static avg (field: CalcFieldExpression) {
		return new AverageCalcField(field);
	}

	public static sum (field: CalcFieldExpression) {
		return new SumCalcField(field);
	}

	public static sub (field: CalcFieldExpression) {
		return new SubCalcField(field);
	}

	public static max (field: CalcFieldExpression) {
		return new MaxCalcField(field);
	}

	public static min (field: CalcFieldExpression) {
		return new MinCalcField(field);
	}

	public static concat (...fields: CalcFieldExpression[]) {
		return new ConcatCalcField(...fields);
	}

}

export type FieldExpression = string | Field
export type CalcFieldExpression = string | Field | CalcField
export type ValueExpression = Field | string | number | boolean | Date | null
export type BitwiseOperatorExpression = "and" | "or" | "xor"
export type ComparisonOperatorExpression = "=" | "!=" | ">" | ">=" | "<" | "<=" | "beginsWith" | "in"
export type DirectionExpression = "asc" | "desc"
export type AggregateExpression = Map<string, CalcField>
export type DataExpression = Map<string, ValueExpression>
export type JoinExpression = Map<string, { query: SelectQuery, on: Expression }>
export type Expression = Comparison | Bitwise;

export type QueryReducer<I, O> = (node: I, accumulator: O) => void;
export type QueryReducers<T> = {
	Query?: QueryReducer<Query, T>
	Collection?: QueryReducer<Collection, T>
	Field?: QueryReducer<Field, T>
	SortableField?: QueryReducer<SortableField, T>
	CalcField?: QueryReducer<CalcField, T>
	Comparison?: QueryReducer<Comparison, T>
	Bitwise?: QueryReducer<Bitwise, T>
}

export class Query {

}

export class SelectQuery extends Query {

	private _select?: List<Field>
	private _from?: Collection
	private _join?: JoinExpression
	private _where?: Bitwise
	private _sort?: List<SortableField>
	private _offset?: number
	private _limit?: number

	constructor (select?: List<Field>, from?: Collection, join?: JoinExpression, where?: Bitwise, sort?: List<SortableField>, offset?: number, limit?: number) {
		super();

		this._select = select;
		this._from = from;
		this._join = join;
		this._where = where;
		this._sort = sort;
		this._offset = offset;
		this._limit = limit;
	}

	select (): List<Field> | undefined
	select (...fields: FieldExpression[]): SelectQuery
	select (...fields: any[]): any {
		if (fields.length > 0) {
			return new SelectQuery(List<Field>(fields.map(f => f instanceof Field ? f : new Field(f))), this._from, this._join, this._where, this._sort, this._offset, this._limit);
		}
		return this._select;
	}

	from (): Collection | undefined
	from (collection: Collection): SelectQuery
	from (name: string, namespace?: string): SelectQuery
	from (name?: any, namespace?: any): any {
		if (typeof name === 'string') {
			return new SelectQuery(this._select, this._from ? this._from.rename(name, namespace) : new Collection(name, namespace), this._join, this._where, this._sort, this._offset, this._limit);
		}
		if (name && name instanceof Collection) {
			return new SelectQuery(this._select, name, this._join, this._where, this._sort, this._offset, this._limit);
		}
		return this._from;
	}

	join (): JoinExpression | undefined
	join (alias: string, query: SelectQuery, on: Expression): SelectQuery
	join (alias?: string, query?: SelectQuery, on?: Expression): any {
		if (typeof alias === 'string') {
			const join = this._join ? this._join : Map<string, { query: SelectQuery, on: Expression }>();
			return new SelectQuery(this._select, this._from, join.set(alias, { query: <SelectQuery>query, on: <Expression>on }), this._where, this._sort, this._offset, this._limit);
		}
		return this._join;
	}

	offset (): number | undefined
	offset (offset: number): SelectQuery
	offset (offset?: number): any {
		if (typeof offset === 'number') {
			if (offset === this._offset) {
				return this;
			}
			return new SelectQuery(this._select, this._from, this._join, this._where, this._sort, offset, this._limit);
		}
		return this._offset;
	}

	limit (): number | undefined
	limit (limit: number): SelectQuery
	limit (limit?: number): any {
		if (typeof limit === 'number') {
			if (limit === this._limit) {
				return this;
			}
			return new SelectQuery(this._select, this._from, this._join, this._where, this._sort, this._offset, limit);
		}
		return this._limit;
	}

	where (): Bitwise | undefined
	where (query: Bitwise): SelectQuery
	where (query?: Bitwise): any {
		if (query && query instanceof Bitwise) {
			return new SelectQuery(this._select, this._from, this._join, query, this._sort, this._offset, this._limit);
		}
		return this._where;
	}

	and (queries: List<Expression>): SelectQuery
	and (...queries: Expression[]): SelectQuery
	and (queries: any) {
		return new SelectQuery(this._select, this._from, this._join, new Bitwise("and", queries), this._sort, this._offset, this._limit);
	}

	or (queries: List<Expression>): SelectQuery
	or (...queries: Expression[]): SelectQuery
	or (queries: any) {
		return new SelectQuery(this._select, this._from, this._join, new Bitwise("or", queries), this._sort, this._offset, this._limit);
	}

	xor (queries: List<Expression>): SelectQuery
	xor (...queries: Expression[]): SelectQuery
	xor (queries: any) {
		return new SelectQuery(this._select, this._from, this._join, new Bitwise("xor", queries), this._sort, this._offset, this._limit);
	}

	eq (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonEqual(field, value)), this._sort, this._offset, this._limit);
	}

	ne (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonNotEqual(field, value)), this._sort, this._offset, this._limit);
	}

	gt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonGreaterThan(field, value)), this._sort, this._offset, this._limit);
	}

	gte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonGreaterThanOrEqual(field, value)), this._sort, this._offset, this._limit);
	}

	lt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonLesserThan(field, value)), this._sort, this._offset, this._limit);
	}

	lte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonLesserThanOrEqual(field, value)), this._sort, this._offset, this._limit);
	}

	in (field: string, values: ValueExpression[]) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonIn(field, values)), this._sort, this._offset, this._limit);
	}

	beginsWith (field: string, value: string) {
		const where = this._where || new Bitwise('and');
		return new SelectQuery(this._select, this._from, this._join, where.add(new ComparisonBeginsWith(field, value)), this._sort, this._offset, this._limit);
	}

	sort (): List<SortableField> | undefined
	sort (field: string, direction?: DirectionExpression): SelectQuery
	sort (...fields: SortableField[]): SelectQuery
	sort (...fields: any[]): any {
		if (fields.length <= 2 && typeof fields[0] === 'string') {
			const sort = this._sort ? this._sort : List<SortableField>();
			const name = <string>fields[0];
			const direction = fields.length === 2 ? <DirectionExpression>fields[1] : undefined;
			return new SelectQuery(this._select, this._from, this._join, this._where, sort.push(new SortableField(name, direction)), this._offset, this._limit);
		}
		else if (fields.length > 0) {
			return new SelectQuery(this._select, this._from, this._join, this._where, List<SortableField>(fields), this._offset, this._limit);
		}
		return this._sort;
	}

	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}SELECT `;

		if (this._select) {
			query += this._select.map<string>(field => field ? field.toString() : ``).join(', ');
		} else {
			query += `*`;
		}

		if (this._from) {
			query += `${newline}${indent}FROM ${this._from.toString()}`;
		}

		if (this._join) {
			query += this._join.map<string>((value, alias) => {
				if (value) {
					return `${newline}${indent}JOIN (${value.query.toString()}) AS ${alias} ON ${value.on.toString()}`;
				}
				return '';
			}).join('');
		}

		if (this._where) {
			query += `${newline}${indent}WHERE ${this._where.toString()}`;
		}

		if (this._sort) {
			query += `${newline}${indent}SORT BY ${this._sort.map<string>(s => s ? s.toString() : '').join(', ')}`;
		}

		if (this._offset !== undefined) {
			query += `${newline}${indent}OFFSET ${this._offset}`;
		}

		if (this._limit !== undefined) {
			query += `${newline}${indent}LIMIT ${this._limit}`;
		}

		return query;
	}
}

export class UnionQuery extends Query {

	private _selects?: List<SelectQuery>
	private _sort?: List<SortableField>
	private _offset?: number
	private _limit?: number

	constructor (selects?: List<SelectQuery>, sort?: List<SortableField>, offset?: number, limit?: number) {
		super();

		this._selects = selects;
		this._sort = sort;
		this._offset = offset;
		this._limit = limit;
	}

	select (): List<SelectQuery> | undefined
	select (...selects: SelectQuery[]): UnionQuery
	select (...selects: any[]): any {
		if (selects.length > 0) {
			return new UnionQuery(List<SelectQuery>(selects), this._sort, this._offset, this._limit);
		}
		return this._selects;
	}

	offset (): number | undefined
	offset (offset: number): UnionQuery
	offset (offset?: number): any {
		if (typeof offset === 'number') {
			if (offset === this._limit) {
				return this;
			}
			return new UnionQuery(this._selects, this._sort, offset, this._limit);
		}
		return this._offset;
	}

	limit (): number | undefined
	limit (limit: number): UnionQuery
	limit (limit?: number): any {
		if (typeof limit === 'number') {
			if (limit === this._limit) {
				return this;
			}
			return new UnionQuery(this._selects, this._sort, this._offset, limit);
		}
		return this._limit;
	}

	sort (): List<SortableField> | undefined
	sort (field: string, direction?: DirectionExpression): UnionQuery
	sort (...fields: SortableField[]): UnionQuery
	sort (...fields: any[]): any {
		if (fields.length <= 2 && typeof fields[0] === 'string') {
			const sort = this._sort ? this._sort : List<SortableField>();
			const name = <string>fields[0];
			const direction = fields.length === 2 ? <DirectionExpression>fields[1] : undefined;
			return new UnionQuery(this._selects, sort.push(new SortableField(name, direction)), this._offset, this._limit);
		}
		else if (fields.length > 0) {
			return new UnionQuery(this._selects, List<SortableField>(fields), this._offset, this._limit);
		}
		return this._sort;
	}

	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';

		if (this._selects) {
			let query = `(${newline}${this._selects.map<string>(s => s ? s.toString(!!multiline, `${indent}\t`) : '').join(`${newline}) UNION (${newline}`)}${newline})`;

			if (this._sort) {
				query += `${newline}${indent}SORT BY ${this._sort.map<string>(s => s ? s.toString() : '').join(', ')}`;
			}

			if (this._offset !== undefined) {
				query += `${newline}${indent}OFFSET ${this._offset}`;
			}

			if (this._limit !== undefined) {
				query += `${newline}${indent}LIMIT ${this._limit}`;
			}

			return query;
		}
		return '';
	}
}

export class AggregateQuery extends Query {
	private _select?: AggregateExpression
	private _from?: Collection
	private _join?: JoinExpression
	private _where?: Bitwise
	private _group?: List<Field>
	private _sort?: List<SortableField>
	private _offset?: number
	private _limit?: number

	constructor (select?: AggregateExpression, from?: Collection, join?: JoinExpression, where?: Bitwise, group?: List<Field>, sort?: List<SortableField>, offset?: number, limit?: number) {
		super();

		this._select = select;
		this._from = from;
		this._where = where;
		this._group = group;
		this._sort = sort;
		this._offset = offset;
		this._limit = limit;
	}

	select (): AggregateExpression | undefined
	select (fields: { [field: string]: CalcField }): AggregateQuery
	select (fields: AggregateExpression): AggregateQuery
	select (fields?: any): any {
		if (fields) {
			return new AggregateQuery(Map<string, CalcField>(fields), this._from, this._join, this._where, this._group, this._sort, this._offset, this._limit);
		}
		return this._select;
	}

	from (): Collection | undefined
	from (collection: Collection): AggregateQuery
	from (name: string, namespace?: string): AggregateQuery
	from (name?: any, namespace?: any): any {
		if (typeof name === 'string') {
			return new AggregateQuery(this._select, this._from ? this._from.rename(name, namespace) : new Collection(name, namespace), this._join, this._where, this._group, this._sort, this._offset, this._limit);
		}
		else if (name && name instanceof Collection) {
			return new AggregateQuery(this._select, name, this._join, this._where, this._group, this._sort, this._offset, this._limit);
		}
		return this._from;
	}

	join (): JoinExpression | undefined
	join (alias: string, query: SelectQuery, on: Expression): AggregateQuery
	join (alias?: string, query?: SelectQuery, on?: Expression): any {
		if (typeof alias === 'string') {
			const join = this._join ? this._join : Map<string, { query: SelectQuery, on: Expression }>();
			return new AggregateQuery(this._select, this._from, join.set(alias, { query: <SelectQuery>query, on: <Expression>on }), this._where, this._group, this._sort, this._offset, this._limit);
		}
		return this._join;
	}

	offset (): number | undefined
	offset (offset: number): DeleteQuery
	offset (offset?: number): any {
		if (typeof offset === 'number') {
			if (offset === this._offset) {
				return this;
			}
			return new AggregateQuery(this._select, this._from, this._join, this._where, this._group, this._sort, offset, this._limit);
		}
		return this._offset;
	}

	limit (): number | undefined
	limit (limit: number): DeleteQuery
	limit (limit?: number): any {
		if (typeof limit === 'number') {
			if (limit === this._limit) {
				return this;
			}
			return new AggregateQuery(this._select, this._from, this._join, this._where, this._group, this._sort, this._offset, limit);
		}
		return this._limit;
	}

	where (): Bitwise | undefined
	where (query: Bitwise): AggregateQuery
	where (query?: Bitwise): any {
		if (query && query instanceof Bitwise) {
			return new AggregateQuery(this._select, this._from, this._join, query, this._group, this._sort, this._offset, this._limit);
		}
		return this._where;
	}

	and (queries: List<Expression>): AggregateQuery
	and (...queries: Expression[]): AggregateQuery
	and (queries: any) {
		return new AggregateQuery(this._select, this._from, this._join, new Bitwise("and", queries), this._group, this._sort, this._offset, this._limit);
	}

	or (queries: List<Expression>): AggregateQuery
	or (...queries: Expression[]): AggregateQuery
	or (queries: any) {
		return new AggregateQuery(this._select, this._from, this._join, new Bitwise("or", queries), this._group, this._sort, this._offset, this._limit);
	}

	xor (queries: List<Expression>): AggregateQuery
	xor (...queries: Expression[]): AggregateQuery
	xor (queries: any) {
		return new AggregateQuery(this._select, this._from, this._join, new Bitwise("xor", queries), this._group, this._sort, this._offset, this._limit);
	}

	eq (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonEqual(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	ne (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonNotEqual(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	gt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonGreaterThan(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	gte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonGreaterThanOrEqual(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	lt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonLesserThan(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	lte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonLesserThanOrEqual(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	in (field: string, values: ValueExpression[]) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonIn(field, values)), this._group, this._sort, this._offset, this._limit);
	}

	beginsWith (field: string, value: string) {
		const where = this._where || new Bitwise('and');
		return new AggregateQuery(this._select, this._from, this._join, where.add(new ComparisonBeginsWith(field, value)), this._group, this._sort, this._offset, this._limit);
	}

	sort (): List<SortableField> | undefined
	sort (field: string, direction?: DirectionExpression): AggregateQuery
	sort (...fields: SortableField[]): AggregateQuery
	sort (...fields: any[]): any {
		if (fields.length <= 2 && typeof fields[0] === 'string') {
			const sort = this._sort ? this._sort : List<SortableField>();
			const name = <string>fields[0];
			const direction = fields.length === 2 ? <DirectionExpression>fields[1] : undefined;
			return new AggregateQuery(this._select, this._from, this._join, this._where, this._group, sort.push(new SortableField(name, direction)), this._offset, this._limit);
		}
		else if (fields.length > 0) {
			return new AggregateQuery(this._select, this._from, this._join, this._where, this._group, List<SortableField>(fields), this._offset, this._limit);
		}
		return this._sort;
	}

	group (): List<Field> | undefined
	group (...fields: FieldExpression[]): AggregateQuery
	group (...fields: any[]): any {
		if (fields.length > 0) {
			return new AggregateQuery(this._select, this._from, this._join, this._where, List<Field>(fields.map(f => f instanceof Field ? f : new Field(f))), this._sort, this._offset, this._limit);
		}
		return this._group;
	}

	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}AGGREGATE `;

		if (this._select) {
			query += this._select.map<string>((field, alias) => field && alias ? `${field.toString()} AS ${alias}` : ``).join(', ');
		} else {
			query += `*`;
		}

		if (this._from) {
			query += `${newline}${indent}FROM ${this._from.toString()}`;
		}

		if (this._join) {
			query += this._join.map<string>((value, alias) => {
				if (value) {
					return `${newline}${indent}JOIN (${value.query.toString()}) AS ${alias} ON ${value.on.toString()}`;
				}
				return '';
			}).join('');
		}

		if (this._where) {
			query += `${newline}${indent}WHERE ${this._where.toString()}`;
		}

		if (this._group) {
			query += `${newline}${indent}GROUP BY ${this._group.map<string>(s => s ? s.toString() : '').join(', ')}`;
		}

		if (this._sort) {
			query += `${newline}${indent}SORT BY ${this._sort.map<string>(s => s ? s.toString() : '').join(', ')}`;
		}

		if (this._offset !== undefined) {
			query += `${newline}${indent}OFFSET ${this._offset}`;
		}

		if (this._limit !== undefined) {
			query += `${newline}${indent}LIMIT ${this._limit}`;
		}

		return query;
	}
}

export class InsertQuery extends Query {
	private _data?: DataExpression
	private _collection?: Collection

	constructor (data?: DataExpression, collection?: Collection) {
		super();

		this._data = data;
		this._collection = collection;
	}

	fields (): DataExpression | undefined
	fields (data: { [field: string]: ValueExpression }): InsertQuery
	fields (data: DataExpression): InsertQuery
	fields (data?: any): any {
		if (data) {
			return new InsertQuery(Map<string, ValueExpression>(data), this._collection);
		}
		return this._data;
	}

	collection (): Collection | undefined
	collection (collection: Collection): UpdateQuery
	collection (name: string, namespace?: string): InsertQuery
	collection (name?: any, namespace?: any): any {
		if (typeof name === 'string') {
			return new InsertQuery(this._data, this._collection ? this._collection.rename(name, namespace) : new Collection(name, namespace));
		}
		else if (name && name instanceof Collection) {
			return new InsertQuery(this._data, name);
		}
		return this._collection;
	}

	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}INSERT `;

		if (this._collection) {
			query += this._collection.toString();
		}

		if (this._data) {
			query += `${newline}${indent}(${this._data.map<string>((value, key) => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES (${this._data.map<string>(value => {
				if (typeof value === 'string') {
					return `"${value}"`;
				}
				return `${value}`;
			}).join(', ')})`;
		}

		return query;
	}
}

export class UpdateQuery extends Query {
	private _data?: DataExpression
	private _collection?: Collection
	private _where?: Bitwise
	private _limit?: number

	constructor (data?: DataExpression, collection?: Collection, where?: Bitwise, limit?: number) {
		super();

		this._data = data;
		this._collection = collection;
		this._where = where;
		this._limit = limit;
	}

	fields (): DataExpression | undefined
	fields (data: { [field: string]: ValueExpression }): UpdateQuery
	fields (data: DataExpression): UpdateQuery
	fields (data?: any): any {
		if (data) {
			return new UpdateQuery(Map<string, ValueExpression>(data), this._collection, this._where, this._limit);
		}
		return this._data;
	}

	collection (): Collection | undefined
	collection (collection: Collection): UpdateQuery
	collection (name: string, namespace?: string): UpdateQuery
	collection (name?: any, namespace?: any): any {
		if (typeof name === 'string') {
			return new UpdateQuery(this._data, this._collection ? this._collection.rename(name, namespace) : new Collection(name, namespace), this._where, this._limit);
		}
		else if (name && name instanceof Collection) {
			return new UpdateQuery(this._data, name, this._where, this._limit);
		}
		return this._collection;
	}

	limit (): number | undefined
	limit (limit: number): UpdateQuery
	limit (limit?: number): any {
		if (typeof limit === 'number') {
			if (limit === this._limit) {
				return this;
			}
			return new UpdateQuery(this._data, this._collection, this._where, limit);
		}
		return this._limit;
	}

	where (): Bitwise | undefined
	where (query: Bitwise): UpdateQuery
	where (query?: Bitwise): any {
		if (query && query instanceof Bitwise) {
			return new UpdateQuery(this._data, this._collection, query, this._limit);
		}
		return this._where;
	}

	and (queries: List<Expression>): UpdateQuery
	and (...queries: Expression[]): UpdateQuery
	and (queries: any) {
		return new UpdateQuery(this._data, this._collection, new Bitwise("and", queries), this._limit);
	}

	or (queries: List<Expression>): UpdateQuery
	or (...queries: Expression[]): UpdateQuery
	or (queries: any) {
		return new UpdateQuery(this._data, this._collection, new Bitwise("or", queries), this._limit);
	}

	xor (queries: List<Expression>): UpdateQuery
	xor (...queries: Expression[]): UpdateQuery
	xor (queries: any) {
		return new UpdateQuery(this._data, this._collection, new Bitwise("xor", queries), this._limit);
	}

	eq (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonEqual(field, value)), this._limit);
	}

	ne (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonNotEqual(field, value)), this._limit);
	}

	gt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonGreaterThan(field, value)), this._limit);
	}

	gte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonGreaterThanOrEqual(field, value)), this._limit);
	}

	lt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonLesserThan(field, value)), this._limit);
	}

	lte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonLesserThanOrEqual(field, value)), this._limit);
	}

	in (field: string, values: ValueExpression[]) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonIn(field, values)), this._limit);
	}

	beginsWith (field: string, value: string) {
		const where = this._where || new Bitwise('and');
		return new UpdateQuery(this._data, this._collection, where.add(new ComparisonBeginsWith(field, value)), this._limit);
	}

	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}UPDATE `;

		if (this._collection) {
			query += this._collection.toString();
		}

		if (this._data) {
			query += `${newline}${indent}(${this._data.map<string>((value, key) => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES (${this._data.map<string>(value => {
				if (typeof value === 'string') {
					return `"${value}"`;
				}
				return `${value}`;
			}).join(', ')})`;
		}

		if (this._where) {
			query += `${newline}${indent}WHERE ${newline}${indent}WHERE ${this._where.toString()}`;
		}

		if (this._limit !== undefined) {
			query += `${newline}${indent}LIMIT ${this._limit}`;
		}

		return query;
	}
}

export class ReplaceQuery extends UpdateQuery {
	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		return super.toString(!!multiline, indent || '').replace(/^(\s+)UPDATE/, `$1REPLACE`);
	}
}

export class DeleteQuery extends Query {
	private _collection?: Collection
	private _where?: Bitwise
	private _limit?: number

	constructor (collection?: Collection, where?: Bitwise, limit?: number) {
		super();

		this._collection = collection;
		this._where = where;
		this._limit = limit;
	}

	collection (): Collection | undefined
	collection (collection: Collection): DeleteQuery
	collection (name: string, namespace?: string): DeleteQuery
	collection (name?: any, namespace?: any): any {
		if (typeof name === 'string') {
			return new DeleteQuery(this._collection ? this._collection.rename(name, namespace) : new Collection(name, namespace), this._where, this._limit);
		}
		else if (name && name instanceof Collection) {
			return new DeleteQuery(name, this._where, this._limit);
		}
		return this._collection;
	}

	limit (): number | undefined
	limit (limit: number): DeleteQuery
	limit (limit?: number): any {
		if (typeof limit === 'number') {
			if (limit === this._limit) {
				return this;
			}
			return new DeleteQuery(this._collection, this._where, limit);
		}
		return this._limit;
	}

	where (): Bitwise | undefined
	where (query: Bitwise): DeleteQuery
	where (query?: Bitwise): any {
		if (query && query instanceof Bitwise) {
			return new DeleteQuery(this._collection, query, this._limit);
		}
		return this._where;
	}

	and (queries: List<Expression>): DeleteQuery
	and (...queries: Expression[]): DeleteQuery
	and (queries: any) {
		return new DeleteQuery(this._collection, new Bitwise("and", queries), this._limit);
	}

	or (queries: List<Expression>): DeleteQuery
	or (...queries: Expression[]): DeleteQuery
	or (queries: any) {
		return new DeleteQuery(this._collection, new Bitwise("or", queries), this._limit);
	}

	xor (queries: List<Expression>): DeleteQuery
	xor (...queries: Expression[]): DeleteQuery
	xor (queries: any) {
		return new DeleteQuery(this._collection, new Bitwise("xor", queries), this._limit);
	}

	eq (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonEqual(field, value)), this._limit);
	}

	ne (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonNotEqual(field, value)), this._limit);
	}

	gt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonGreaterThan(field, value)), this._limit);
	}

	gte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonGreaterThanOrEqual(field, value)), this._limit);
	}

	lt (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonLesserThan(field, value)), this._limit);
	}

	lte (field: string, value: ValueExpression) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonLesserThanOrEqual(field, value)), this._limit);
	}

	in (field: string, values: ValueExpression[]) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonIn(field, values)), this._limit);
	}

	beginsWith (field: string, value: string) {
		const where = this._where || new Bitwise('and');
		return new DeleteQuery(this._collection, where.add(new ComparisonBeginsWith(field, value)), this._limit);
	}

	toString (): string
	toString (multiline: boolean): string
	toString (multiline: boolean, indent: string): string
	toString (multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}DELETE `;

		if (this._collection) {
			query += this._collection.toString();
		}

		if (this._where) {
			query += `${newline}${indent}WHERE ${this._where.toString()}`;
		}

		if (this._limit !== undefined) {
			query += `${newline}${indent}LIMIT ${this._limit}`;
		}

		return query;
	}
}

export class Collection {
	private _name: string
	private _namespace?: string

	constructor (name: string, namespace?: string) {
		this._name = name;
		this._namespace = namespace;
	}

	public get name () {
		return this._name;
	}

	public get namespace () {
		return this._namespace;
	}

	public rename (name: string, namespace?: string) {
		if (name === this._name && namespace === this._namespace) {
			return this;
		}
		return new Collection(name, namespace);
	}

	public toString () {
		if (this._namespace) {
			return `${this._namespace}.${this._name}`;
		}
		return this._name;
	}
}

export class Field {
	private _name: string
	private _table?: string

	constructor (name: string, table?: string) {
		this._name = name;
		this._table = table;
	}

	public get name () {
		return this._name;
	}

	public get table () {
		return this._table;
	}

	public rename (name: string, table?: string) {
		if (name === this._name && this._table === table) {
			return this;
		}
		return new Field(name, table);
	}

	public toString () {
		if (this._table) {
			return `${this.table}.${this._name}`;
		}
		return `${this._name}`;
	}
}

export class SortableField {
	private _name: string
	private _direction?: DirectionExpression

	constructor (name: string, direction?: DirectionExpression) {
		this._name = name;
		this._direction = direction;
	}

	public get name () {
		return this._name;
	}

	public get direction () {
		return this._direction;
	}

	public rename (name: string) {
		if (name === this._name) {
			return this;
		}
		return new SortableField(name, this._direction);
	}

	public sort (direction: DirectionExpression) {
		if (direction === this._direction) {
			return this;
		}
		return new SortableField(this._name, direction);
	}

	public toString () {
		if (this._direction) {
			return `${this._name} ${this._direction}`;
		}
		return this._name;
	}
}

export class CalcField {
	private _function: string

	constructor (fn: string) {
		this._function = fn;
	}

	public get function () {
		return this._function;
	}

	public toString () {
		return `${this._function.toLocaleUpperCase()}()`;
	}
}

export class CountCalcField extends CalcField {

	private _field: Field

	constructor (field: FieldExpression) {
		super('count');
		this._field = field instanceof Field ? field : new Field(field);
	}

	public get field () {
		return this._field;
	}

	public toString () {
		return `COUNT(${this._field.toString()})`;
	}
}

export class AverageCalcField extends CalcField {

	private _field: Field | CalcField

	constructor (field: CalcFieldExpression) {
		super('avg');
		this._field = typeof field === 'string' ? new Field(field) : field;
	}

	public get field () {
		return this._field;
	}

	public toString () {
		return `AVG(${this._field.toString()})`;
	}
}

export class SumCalcField extends CalcField {

	private _field: Field | CalcField

	constructor (field: CalcFieldExpression) {
		super('sum');
		this._field = typeof field === 'string' ? new Field(field) : field;
	}

	public get field () {
		return this._field;
	}

	public toString () {
		return `SUM(${this._field.toString()})`;
	}
}

export class SubCalcField extends CalcField {

	private _field: Field | CalcField

	constructor (field: CalcFieldExpression) {
		super('sub');
		this._field = typeof field === 'string' ? new Field(field) : field;
	}

	public get field () {
		return this._field;
	}

	public toString () {
		return `SUB(${this._field.toString()})`;
	}
}

export class MaxCalcField extends CalcField {

	private _fields: List<Field | CalcField>

	constructor (...fields: CalcFieldExpression[]) {
		super('max');
		this._fields = List<Field | CalcField>(fields.map(f => typeof f === 'string' ? new Field(f) : f));
	}

	public get fields () {
		return this._fields;
	}

	public toString () {
		return `MAX(${this._fields.map(f => f ? f.toString() : '').join(', ')})`;
	}
}

export class MinCalcField extends CalcField {

	private _fields: List<Field | CalcField>

	constructor (...fields: CalcFieldExpression[]) {
		super('min');
		this._fields = List<Field | CalcField>(fields.map(f => typeof f === 'string' ? new Field(f) : f));
	}

	public get fields () {
		return this._fields;
	}

	public toString () {
		return `MIN(${this._fields.map(f => f ? f.toString() : '').join(', ')})`;
	}
}

export class ConcatCalcField extends CalcField {

	private _fields: List<Field | CalcField>

	constructor (...fields: CalcFieldExpression[]) {
		super('concat');
		this._fields = List<Field | CalcField>(fields.map(f => typeof f === 'string' ? new Field(f) : f));
	}

	public get fields () {
		return this._fields;
	}

	public toString () {
		return `CONCAT(${this._fields.map(f => f ? f.toString() : '').join(', ')})`;
	}
}

export class Comparison {
	protected _field: FieldExpression
	protected _operator: ComparisonOperatorExpression

	constructor (field: FieldExpression, operator: ComparisonOperatorExpression) {
		this._field = field;
		this._operator = operator;
	}

	public get field () {
		return this._field;
	}

	public get operator () {
		return this._operator;
	}

	public toString (): string {
		return `${this._field.toString()} ${this._operator}`;
	}
}

export class ComparisonSimple extends Comparison {
	private _value?: ValueExpression

	constructor (field: FieldExpression, operator: ComparisonOperatorExpression, value: ValueExpression) {
		super(field, operator);
		this._value = value;
	}

	public get value () {
		return this._value;
	}

	set (value: ValueExpression) {
		if (value === this._value) {
			return this;
		}
		return new ComparisonSimple(this._field, this._operator, value);
	}

	public toString () {
		const value = typeof this._value === 'string' ? `"${this._value}"` : `${this._value}`;
		return `${this._field.toString()} ${this._operator} ${value}`;
	}
}

export class ComparisonEqual extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, '=', value);
	}
}

export class ComparisonNotEqual extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, '!=', value);
	}
}

export class ComparisonGreaterThan extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, '>', value);
	}
}

export class ComparisonGreaterThanOrEqual extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, '>=', value);
	}
}

export class ComparisonLesserThan extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, '<', value);
	}
}

export class ComparisonLesserThanOrEqual extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, '<=', value);
	}
}

export class ComparisonBeginsWith extends ComparisonSimple {
	constructor (field: FieldExpression, value: ValueExpression) {
		super(field, 'beginsWith', value);
	}
}

export class ComparisonIn extends Comparison {
	private _values?: List<ValueExpression>

	constructor (field: FieldExpression, values: ValueExpression[]) {
		super(field, 'in');

		this._values = List<ValueExpression>(values);
	}

	public get values () {
		return this._values;
	}

	set (...values: ValueExpression[]) {
		return new ComparisonIn(this._field, values);
	}

	public toString () {
		const value: string = this._values ? `(${this._values.map<string>(v => {
			if (typeof v === 'string') {
				return `"${v}"`;
			}
			return `${v}`;
		}).join(', ')})` : '';

		return `${this._field.toString()} ${this._operator} ${value}`;
	}
}

export class Bitwise {
	private _operator: BitwiseOperatorExpression
	private _operands?: List<Expression>

	constructor (operator: BitwiseOperatorExpression, queries?: Expression[] | List<Expression>) {
		this._operator = operator;
		this._operands = queries ? List<Expression>(queries) : List<Expression>();
	}

	public get operator () {
		return this._operator;
	}

	public get operands () {
		return this._operands;
	}

	public get isLeaf () {
		return this.operands === undefined || this.operands.filter(op => op instanceof Bitwise).count() === 0;
	}

	public add (expr: Expression) {
		return new Bitwise(this._operator, this._operands ? this._operands.push(expr) : undefined);
	}

	public remove (expr: Expression) {
		if (this._operands) {
			if (this._operands.contains(expr)) {
				return new Bitwise(this._operator, this._operands.filter(op => op !== expr).toList());
			}
		}
		return this;
	}

	public replace (searchValue: Expression, newValue: Expression, deep?: boolean): Bitwise {
		if (this === searchValue) {
			return <Bitwise>newValue;
		}
		if (this._operands) {
			const replaced = this._operands.withMutations((list) => {
				list.forEach((op, idx = 0) => {
					if (op === searchValue) {
						list = list.update(idx, (op) => newValue);
					}
					else if (op instanceof Bitwise && deep === true) {
						const opUpdated = op.replace(searchValue, newValue, true);
						if (op !== opUpdated) {
							list = list.update(idx, (op) => opUpdated);
						}
					}
				});
			});

			if (replaced !== this._operands) {
				return new Bitwise(this._operator, <List<Expression>>replaced);
			}
		}
		return this;
	}

	public toString (): string {
		if (this._operands) {
			if (this._operands.count() === 1) {
				return this._operands.get(0).toString();
			}
			return `(${this._operands.map(op => op ? op.toString() : '').join(` ${this._operator} `)})`;
		}
		return ``;
	}
}

export class TooComplexQueryError extends Error {

}

export class QueryNotSupportedError extends Error {

}

export class QuerySyntaxError extends Error {
	
}

export function simplifyBitwiseTree (node: Bitwise): Bitwise {
	if (node.isLeaf || node.operands === undefined) {
		return node;
	}

	let simplified = new Bitwise(node.operator);
	node.operands.forEach(operand => {
		if (operand instanceof Comparison) {
			simplified = simplified.add(operand);
		}
		else if (operand instanceof Bitwise && operand.operator === node.operator) {
			operand = simplifyBitwiseTree(operand);
			if (operand.operands) {
				operand.operands.forEach(operand => {
					simplified = simplified.add(<Expression>operand);
				});
			}
		}
		else if (operand instanceof Bitwise) {
			simplified = simplified.add(simplifyBitwiseTree(operand));
		}
	});

	return simplified;
}

export function reduceQuery<T> (reducers: QueryReducers<T>, initial: T, node: Query | Collection | Field | SortableField | CalcField | Expression): T {

	if (node instanceof Query && reducers.Query) {
		reducers.Query(node, initial);
	}
	else if (node instanceof Collection && reducers.Collection) {
		reducers.Collection(node, initial);
	}
	else if (node instanceof Field && reducers.Field) {
		reducers.Field(node, initial);
	}
	else if (node instanceof SortableField && reducers.SortableField) {
		reducers.SortableField(node, initial);
	}
	else if (node instanceof CalcField && reducers.CalcField) {
		reducers.CalcField(node, initial);
	}
	else if (node instanceof Comparison && reducers.Comparison) {
		reducers.Comparison(node, initial);
	}
	else if (node instanceof Bitwise && reducers.Bitwise) {
		reducers.Bitwise(node, initial);
	}

	return initial;
}