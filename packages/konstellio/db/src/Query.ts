import * as assert from 'assert';
import { Map, List } from 'immutable';
import { isArray } from 'util';

function isKeyOf<T = any>(value: any): value is keyof T {
	return typeof value === 'string';
}

// tslint:disable:class-name
export class q {
	public static select<F = any, I = any>(...fields: (keyof F | Field<F>)[]) {
		return new QuerySelect<F, I>().select(...fields);
	}

	public static aggregate<F = any, I = any>(...fields: (keyof F | Field<F> | FieldAs<F>)[]) {
		return new QueryAggregate<F, I>().select(...fields);
	}

	public static union<F = any, I = any>(...selects: QuerySelect<F, I>[]) {
		return new QueryUnion<F, I>(List(selects));
	}

	public static insert<F = any>(name: string | Collection) {
		return new QueryInsert<F>().into(name);
	}

	public static update<F = any, I = any>(name: string | Collection) {
		return new QueryUpdate<F, I>().from(name);
	}

	public static delete<I = any>(name: string | Collection) {
		return new QueryDelete<I>().from(name);
	}

	public static showCollection() {
		return new QueryShowCollection();
	}

	public static createCollection(name: string | Collection) {
		return new QueryCreateCollection(typeof name === 'string' ? new Collection(name) : name);
	}

	public static describeCollection(name: string | Collection) {
		return new QueryDescribeCollection(typeof name === 'string' ? new Collection(name) : name);
	}

	public static alterCollection(name: string | Collection) {
		return new QueryAlterCollection(typeof name === 'string' ? new Collection(name) : name);
	}

	public static collectionExists(name: string | Collection) {
		return new QueryCollectionExists(typeof name === 'string' ? new Collection(name) : name);
	}

	public static dropCollection(name: string | Collection) {
		return new QueryDropCollection(typeof name === 'string' ? new Collection(name) : name);
	}

	public static collection(name: string, namespace?: string) {
		return new Collection(name, namespace);
	}

	public static column(name: string, type: ColumnType, size?: number, defaultValue?: any, autoIncrement?: boolean) {
		return new Column(name, type, size, defaultValue, autoIncrement);
	}

	public static index(name: string, type: IndexType, columns?: FieldDirection[]) {
		return new Index(name, type, List(columns || []));
	}

	public static var(name: string) {
		return new Variable(name);
	}

	public static field<F = any>(name: keyof F, alias?: string) {
		return new Field<F>(name, alias);
	}

	public static sort<I = any>(field: keyof I | Field<I>, direction: Direction = 'asc') {
		return new FieldDirection<I>(isKeyOf(field) ? new Field(field) : field, direction);
	}

	public static as<F = any>(field: keyof F | Field<F> | Function<F>, alias: string) {
		return new FieldAs<F>(isKeyOf(field) ? new Field(field) : field, alias);
	}

	public static count<F = any>(field: keyof F | Field<F>) {
		return new FunctionCount<F>(List([isKeyOf(field) ? new Field(field) : field]));
	}

	public static avg<F = any>(...args: Value<F>[]) {
		return new FunctionAvg<F>(List<Value<F>>(args));
	}

	public static sum<F = any>(...args: Value<F>[]) {
		return new FunctionSum<F>(List<Value<F>>(args));
	}

	public static sub<F = any>(...args: Value<F>[]) {
		return new FunctionSub<F>(List<Value<F>>(args));
	}

	public static max<F = any>(...args: Value<F>[]) {
		return new FunctionMax<F>(List<Value<F>>(args));
	}

	public static min<F = any>(...args: Value<F>[]) {
		return new FunctionMin<F>(List<Value<F>>(args));
	}

	public static concat<F = any>(...args: Value<F>[]) {
		return new FunctionConcat<F>(List<Value<F>>(args));
	}

	public static eq<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		value: F[K] | Field<F> | Function<F>
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonEqual<F>(isKeyOf(field) ? new Field(field) : field, List([value as Value]));
	}

	public static ne<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		value: F[K] | Field<F> | Function<F>
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonNotEqual<F>(isKeyOf(field) ? new Field(field) : field, List([value as Value]));
	}

	public static gt<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		value: F[K] | Field<F> | Function<F>
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonGreaterThan<F>(isKeyOf(field) ? new Field(field) : field, List([value as Value]));
	}

	public static gte<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		value: F[K] | Field<F> | Function<F>
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonGreaterThanOrEqual<F>(isKeyOf(field) ? new Field(field) : field, List([value as Value]));
	}

	public static lt<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		value: F[K] | Field<F> | Function<F>
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonLesserThan<F>(isKeyOf(field) ? new Field(field) : field, List([value as Value]));
	}

	public static lte<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		value: F[K] | Field<F> | Function<F>
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonLesserThanOrEqual<F>(isKeyOf(field) ? new Field(field) : field, List([value as Value]));
	}

	public static in<F = any, K extends keyof F = any>(
		field: K | Field<F> | Function<F>,
		values: F[K] | Value<F> | Value<F>[]
	) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		// assert(isArray(values) && values.length > 0);

		return new ComparisonIn<F>(
			isKeyOf(field) ? new Field(field) : field,
			List(isArray(values) ? values : [values as Value])
		);
	}

	public static beginsWith<F = any, K extends keyof F = any>(field: K | Field<F> | Function<F>, value: F[K]) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonBeginsWith<F>(isKeyOf(field) ? new Field(field) : field, List([value as any]));
	}

	public static and<I = any>(...operands: BinaryExpression<I>[]) {
		assert(
			operands.length > 0 &&
				operands.filter(op => !(op instanceof Binary || op instanceof Comparison)).length === 0
		);

		return new Binary<I>('and', List(operands));
	}

	public static or<I = any>(...operands: BinaryExpression<I>[]) {
		assert(
			operands.length > 0 &&
				operands.filter(op => !(op instanceof Binary || op instanceof Comparison)).length === 0
		);

		return new Binary<I>('or', List(operands));
	}

	public static xor<I = any>(...operands: BinaryExpression<I>[]) {
		assert(
			operands.length > 0 &&
				operands.filter(op => !(op instanceof Binary || op instanceof Comparison)).length === 0
		);

		return new Binary<I>('xor', List(operands));
	}
}

export class Collection {
	constructor(public readonly name: string, public readonly namespace?: string) {
		assert(typeof name === 'string');
		assert(namespace === undefined || typeof namespace === 'string');
	}

	public rename(name: string, namespace?: string) {
		assert(typeof name === 'string');
		assert(namespace === undefined || typeof namespace === 'string');

		if (name !== this.name || namespace !== this.namespace) {
			return new Collection(name, namespace);
		}
		return this;
	}

	public equal(collection: Collection): boolean {
		return this.name === collection.name && this.namespace === collection.namespace;
	}

	public toString(): string {
		return `${this.namespace ? `${this.namespace}__` : ''}${this.name}`;
	}
}

export enum ColumnType {
	Boolean = 'boolean',
	Bit = 'bit',
	UInt = 'uint',
	Int = 'int',
	Float = 'float',
	Text = 'text',
	Blob = 'blob',
	Date = 'date',
	DateTime = 'datetime',
}

export class Column {
	constructor(
		public readonly name: string,
		public readonly type: ColumnType,
		public readonly size?: number,
		public readonly defaultValue?: any,
		public readonly autoIncrement: boolean = false
	) {
		assert(typeof name === 'string');
		assert(typeof type === 'string');
		assert(size === undefined || typeof size === 'number');
		assert(autoIncrement === undefined || typeof autoIncrement === 'boolean');
	}

	public rename(name: string) {
		assert(typeof name === 'string');

		if (name !== this.name) {
			return new Column(name, this.type, this.size, this.defaultValue, this.autoIncrement);
		}
		return this;
	}

	public resize(size: number) {
		assert(typeof size === 'number' && size > 0);

		if (size !== this.size) {
			return new Column(this.name, this.type, size, this.defaultValue, this.autoIncrement);
		}
		return this;
	}

	public equal(column: Column): boolean {
		return (
			this.name === column.name &&
			this.type === column.type &&
			this.size === column.size &&
			this.defaultValue === column.defaultValue &&
			this.autoIncrement === column.autoIncrement
		);
	}

	public toString(): string {
		return `${this.name} ${this.type.toString().toUpperCase()}${this.size ? `(${this.size})` : ''}${
			this.defaultValue ? ` DEFAULT(${this.defaultValue})` : ''
		}${this.autoIncrement ? ' AUTOINCREMENT' : ''}`;
	}
}

export enum IndexType {
	Primary = 'primary',
	Unique = 'unique',
	Index = 'index',
}

export class Index {
	constructor(
		public readonly name: string,
		public readonly type: IndexType,
		public readonly columns: List<FieldDirection> = List()
	) {
		assert(typeof name === 'string');
		assert(typeof type === 'string');
		assert(columns instanceof List);
	}

	public add(...columns: FieldDirection[]): Index {
		assert(columns.length > 0);
		assert(columns.filter(column => !(column instanceof FieldDirection)).length === 0);

		return new Index(this.name, this.type, this.columns.push(...columns));
	}

	public equal(index: Index): boolean {
		return this.name === index.name && this.type === index.type && this.columns === index.columns;
	}

	public toString(): string {
		return `${this.type.toString().toLocaleUpperCase()} ${this.name} (${this.columns
			.map(c => (c ? c.toString() : ''))
			.join(', ')})`;
	}
}

export type Primitive = string | number | boolean | Date | null;
export type Value<T = any> = Variable | Field<T> | Function<T> | Primitive;
export type Variables = { [key: string]: Primitive | Primitive[] };

export class Variable {
	constructor(public readonly name: string) {
		assert(typeof name === 'string');
	}

	public equal(variable: Variable): boolean {
		return this.name === variable.name;
	}

	public toString(): string {
		return `VAR(${this.name})`;
	}
}

export class Field<T = any> {
	constructor(public readonly name: keyof T, public readonly alias?: string) {
		assert(typeof name === 'string');
		assert(alias === undefined || typeof alias === 'string');
	}

	public rename(name: keyof T, alias?: string): Field<T> {
		assert(typeof name === 'string');
		assert(alias === undefined || typeof alias === 'string');

		if (name !== this.name || alias !== this.alias) {
			return new Field<T>(name, alias || this.alias);
		}
		return this;
	}

	public equal(field: Field): boolean {
		return this.name === field.name && this.alias === field.alias;
	}

	public toString(): string {
		return `${this.alias ? `${this.alias}.` : ''}${this.name}`;
	}
}

export type Direction = 'asc' | 'desc';

export class FieldDirection<T = any> {
	constructor(public readonly field: Field<T>, public readonly direction: Direction = 'asc') {
		assert(field instanceof Field);
		assert(direction === 'asc' || direction === 'desc');
	}

	public sort(direction: Direction): FieldDirection<T> {
		assert(direction === 'asc' || direction === 'desc');

		if (direction !== this.direction) {
			return new FieldDirection(this.field, direction);
		}
		return this;
	}

	public rename(name: Field<T>): FieldDirection<T>;
	public rename(name: keyof T, alias?: string): FieldDirection<T>;
	public rename(name: keyof T | Field<T>, alias?: string): FieldDirection<T> {
		assert(typeof name === 'string' || name instanceof Field);
		assert(alias === undefined || typeof alias === 'string');

		if (name instanceof Field) {
			return new FieldDirection(name, this.direction);
		}
		const renamed = this.field.rename(name, alias);
		if (renamed !== this.field) {
			return new FieldDirection(renamed, this.direction);
		}
		return this;
	}

	public equal(field: FieldDirection): boolean {
		return this.field === field.field && this.direction === field.direction;
	}

	public toString(): string {
		return `${this.field.toString()} ${this.direction.toUpperCase()}`;
	}
}

export abstract class Function<T = any> {
	constructor(public readonly fn: string, public readonly args: List<Value<T>> = List()) {
		assert(typeof fn === 'string');
		assert(args instanceof List);
	}

	public replaceArgument(replacer: (arg: Value<T>) => undefined | Value<T>) {
		assert(typeof replacer === 'function');

		let args = List<Value<T>>();
		let changed = false;

		this.args.forEach(arg => {
			const replaced = replacer(arg!);
			if (replaced) {
				changed = changed || arg !== replaced;
				args = args.push(replaced);
			} else {
				changed = true;
			}
		});

		if (changed) {
			const constructor = this.constructor as any;
			return new constructor(args) as this;
		}
		return this;
	}

	public equal(fn: Function): boolean {
		return this.fn === fn.fn && this.args === fn.args;
	}

	public toString(): string {
		return `${this.fn.toUpperCase()}(${this.args.map(arg => arg && arg.toString()).join(', ')})`;
	}
}

export class FunctionCount<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('count', args);
	}
}

export class FunctionAvg<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('avg', args);
	}
}

export class FunctionSum<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('sum', args);
	}
}

export class FunctionSub<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('sub', args);
	}
}

export class FunctionMax<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('max', args);
	}
}

export class FunctionMin<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('min', args);
	}
}

export class FunctionConcat<T = any> extends Function<T> {
	constructor(args: List<Value<T>>) {
		super('concat', args);
	}
}

export class FieldAs<T = any> {
	constructor(public readonly field: Field<T> | Function<T>, public readonly alias: string) {
		assert(field instanceof Field || field instanceof Function);
		assert(typeof alias === 'string');
	}

	public set(field: Field<T> | Function<T>, alias: string): FieldAs<T> {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(typeof alias === 'string');

		if (this.field !== field || this.alias !== alias) {
			return new FieldAs(field, alias);
		}
		return this;
	}

	public equal(field: FieldAs<T>): boolean {
		return this.field === field.field && this.alias === field.alias;
	}

	public toString(): string {
		return `${this.field.toString()} AS ${this.alias}`;
	}
}

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'beginsWith' | 'in';

export abstract class Comparison<T = any> {
	constructor(
		public readonly field: Field<T> | Function<T>,
		public readonly operator: ComparisonOperator,
		public readonly args: List<Value<T>> = List()
	) {
		assert(field instanceof Field || field instanceof Function);
		assert(
			operator === '=' ||
				operator === '!=' ||
				operator === '>' ||
				operator === '>=' ||
				operator === '<' ||
				operator === '<=' ||
				operator === 'beginsWith' ||
				operator === 'in'
		);
		assert(args instanceof List);
	}

	public rename(name: Field<T> | Function<T>): Comparison<T>;
	public rename(name: keyof T, alias?: string): Comparison<T>;
	public rename(name: keyof T | Field<T> | Function<T>, alias?: string): Comparison<T> {
		assert(typeof name === 'string' || name instanceof Field);
		assert(alias === undefined || typeof alias === 'string');

		const constructor = this.constructor as any;
		if (name instanceof Field || name instanceof Function) {
			return new constructor(name, this.args);
		} else {
			if (this.field instanceof Field) {
				return new constructor(new Field(name), this.args);
			} else {
				const renameArg = (arg: Value): Value => {
					if (arg instanceof Field) {
						return arg.rename(name);
					} else if (arg instanceof Function) {
						return arg.replaceArgument(renameArg);
					}
					return arg;
				};
				const renamed = this.field.replaceArgument(renameArg);
				if (renamed !== this.field) {
					return new constructor(renamed, this.args);
				}
			}
		}
		return this;
	}

	public replaceArgument(replacer: (arg: Value<T>) => undefined | Value<T>) {
		assert(typeof replacer === 'function');

		let args = List<Value<T>>();
		let changed = false;

		this.args.forEach(arg => {
			const replaced = replacer(arg!);
			if (replaced) {
				changed = changed || arg !== replaced;
				args = args.push(replaced);
			} else {
				changed = true;
			}
		});

		if (changed) {
			const constructor = this.constructor as any;
			return new constructor(this.field, args);
		}
		return this;
	}

	public equal(comparison: Comparison<T>): boolean {
		return (
			this.field === comparison.field && this.operator === comparison.operator && this.args === comparison.args
		);
	}

	public toString(): string {
		return `${this.field.toString()} ${this.operator} ${this.args
			.map(arg => (arg ? arg.toString() : 'NULL'))
			.join(', ')}`;
	}
}

export class ComparisonEqual<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, '=', args);
	}
}

export class ComparisonNotEqual<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, '!=', args);
	}
}

export class ComparisonGreaterThan<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, '>', args);
	}
}

export class ComparisonGreaterThanOrEqual<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, '>=', args);
	}
}

export class ComparisonLesserThan<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, '<', args);
	}
}

export class ComparisonLesserThanOrEqual<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, '<=', args);
	}
}

export class ComparisonBeginsWith<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, 'beginsWith', args);
	}
}

export class ComparisonIn<T = any> extends Comparison<T> {
	constructor(field: Field<T> | Function<T>, args: List<Value<T>>) {
		super(field, 'in', args);
	}
}

export type BinaryOperator = 'and' | 'or' | 'xor';
export type BinaryExpression<T = any> = Binary<T> | Comparison<T>;

export class Binary<T = any> {
	constructor(
		public readonly operator: BinaryOperator,
		public readonly operands: List<BinaryExpression<T>> = List()
	) {
		assert(operator === 'and' || operator === 'or' || operator === 'xor');
		assert(operands instanceof List);
	}

	public isLeaf() {
		return this.operands.filter(op => op instanceof Binary).count() === 0;
	}

	public add(expr: BinaryExpression<T>): Binary<T> {
		assert(expr instanceof Binary || expr instanceof Comparison);

		return new Binary(this.operator, this.operands.push(expr));
	}

	public remove(expr: BinaryExpression<T>): Binary<T> {
		assert(expr instanceof Binary || expr instanceof Comparison);

		if (this.operands.contains(expr)) {
			return new Binary<T>(this.operator, this.operands.filter(op => op !== expr).toList());
		}
		return this;
	}

	public replace(search: BinaryExpression<T>, replace: BinaryExpression<T>, deep: boolean = false): Binary<T> {
		assert(search instanceof Binary || search instanceof Comparison);
		assert(replace instanceof Binary || replace instanceof Comparison);
		assert(typeof deep === 'boolean');

		return this.visit(op => {
			if (op === search) {
				return replace;
			}
			return op;
		}, deep);
	}

	public visit(
		visiter: (op: BinaryExpression<T>) => undefined | BinaryExpression<T>,
		deep: boolean = false
	): Binary<T> {
		assert(typeof visiter === 'function');
		assert(typeof deep === 'boolean');

		let operands = List<BinaryExpression<T>>();
		let changed = false;

		this.operands.forEach(arg => {
			const replaced = visiter(arg!);
			if (replaced) {
				changed = changed || arg !== replaced;
				operands = operands.push(replaced);
			} else if (deep && arg instanceof Binary) {
				const replaced = arg.visit(visiter, true);
				if (replaced) {
					changed = changed || arg !== replaced;
					operands = operands.push(replaced);
				} else {
					changed = true;
				}
			} else {
				changed = true;
			}
		});

		if (changed) {
			return new Binary<T>(this.operator, operands);
		}
		return this;
	}

	public equal(binary: Binary<T>): boolean {
		return this.operator === binary.operator && this.operands === binary.operands;
	}

	public toString(): string {
		return `(${this.operands.map(op => op!.toString()).join(` ${this.operator.toUpperCase()} `)})`;
	}
}

export class Query {}

export type Join<F = any, I = any> = {
	alias: string;
	on: BinaryExpression;
	query: QuerySelect<F, I>;
};

export class QuerySelect<F = any, I = any> extends Query {
	// @ts-ignore
	private type: 'select';

	constructor(
		public readonly fields?: List<Field<F> | FieldAs<F>>,
		public readonly collection?: Collection,
		public readonly joins?: List<Join>,
		public readonly conditions?: Binary<I>,
		public readonly sorts?: List<FieldDirection<I>>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public select(...fields: (keyof F | Field<F> | FieldAs<F>)[]): QuerySelect<F, I> {
		return new QuerySelect<F, I>(
			List(fields.map<Field<F> | FieldAs<F>>(field => (isKeyOf(field) ? new Field<F>(field) : field))),
			this.collection,
			this.joins,
			this.conditions,
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public from(name: string | Collection): QuerySelect<F, I> {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QuerySelect(
					this.fields,
					renamed,
					this.joins,
					this.conditions,
					this.sorts,
					this.limit,
					this.offset
				);
			}
		} else if (name !== this.collection) {
			return new QuerySelect(this.fields, name, this.joins, this.conditions, this.sorts, this.limit, this.offset);
		}
		return this;
	}

	public join(alias: string, query: QuerySelect<F, I>, on: BinaryExpression<I>): QuerySelect<F, I> {
		const join: Join = { alias, query, on };
		return new QuerySelect(
			this.fields,
			this.collection,
			this.joins ? this.joins.push(join) : List(join),
			this.conditions,
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public where(condition: BinaryExpression<I>): QuerySelect<F, I> {
		return new QuerySelect(
			this.fields,
			this.collection,
			this.joins,
			condition instanceof Comparison ? new Binary('and', List([condition])) : condition,
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public sort(...fields: FieldDirection<I>[]): QuerySelect<F, I> {
		return new QuerySelect(
			this.fields,
			this.collection,
			this.joins,
			this.conditions,
			List(fields),
			this.limit,
			this.offset
		);
	}

	public range({ limit, offset }: { limit?: number; offset?: number }): QuerySelect<F, I> {
		if (limit !== this.limit || offset !== this.offset) {
			return new QuerySelect(
				this.fields,
				this.collection,
				this.joins,
				this.conditions,
				this.sorts,
				limit !== undefined ? limit : this.limit,
				offset !== undefined ? offset : this.offset
			);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}SELECT `;

		if (this.fields) {
			query += this.fields.map<string>(field => (field ? field.toString() : ``)).join(', ');
		} else {
			query += `*`;
		}

		if (this.collection) {
			query += `${newline}${indent}FROM ${this.collection.toString()}`;
		}

		if (this.joins) {
			query += this.joins
				.map<string>(join => {
					if (join) {
						return `${newline}${indent}JOIN (${join.query.toString()}) AS ${
							join.alias
						} ON ${join.on.toString()}`;
					}
					return '';
				})
				.join('');
		}

		if (this.conditions) {
			query += `${newline}${indent}WHERE ${this.conditions.toString()}`;
		}

		if (this.sorts) {
			query += `${newline}${indent}SORT BY ${this.sorts.map<string>(s => (s ? s.toString() : '')).join(', ')}`;
		}

		if (this.offset !== undefined) {
			query += `${newline}${indent}OFFSET ${this.offset}`;
		}

		if (this.limit !== undefined) {
			query += `${newline}${indent}LIMIT ${this.limit}`;
		}

		return query;
	}
}

export class QueryAggregate<F = any, I = any> extends Query {
	// @ts-ignore
	private type: 'aggregate';

	constructor(
		public readonly fields?: List<Field<F> | FieldAs<F>>,
		public readonly collection?: Collection,
		public readonly joins?: List<Join>,
		public readonly conditions?: Binary<I>,
		public readonly groups?: List<Field<I> | Function<I>>,
		public readonly sorts?: List<FieldDirection<I>>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public select(...fields: (keyof F | Field<F> | FieldAs<F>)[]): QueryAggregate<F, I> {
		return new QueryAggregate(
			List(fields.map<Field<F> | FieldAs<F>>(field => (isKeyOf(field) ? new Field<F>(field) : field))),
			this.collection,
			this.joins,
			this.conditions,
			this.groups,
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public from(name: string | Collection): QueryAggregate<F, I> {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryAggregate(
					this.fields,
					renamed,
					this.joins,
					this.conditions,
					this.groups,
					this.sorts,
					this.limit,
					this.offset
				);
			}
		} else if (name !== this.collection) {
			return new QueryAggregate(
				this.fields,
				name,
				this.joins,
				this.conditions,
				this.groups,
				this.sorts,
				this.limit,
				this.offset
			);
		}
		return this;
	}

	public join(alias: string, query: QuerySelect<F, I>, on: BinaryExpression<I>): QueryAggregate<F, I> {
		const join: Join = { alias, query, on };
		return new QueryAggregate(
			this.fields,
			this.collection,
			this.joins ? this.joins.push(join) : List([join]),
			this.conditions,
			this.groups,
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public where(condition: BinaryExpression<I>): QueryAggregate<F, I> {
		return new QueryAggregate(
			this.fields,
			this.collection,
			this.joins,
			condition instanceof Comparison ? new Binary('and', List([condition])) : condition,
			this.groups,
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public group(...groups: (Field<I> | Function<I>)[]): QueryAggregate<F, I> {
		return new QueryAggregate(
			this.fields,
			this.collection,
			this.joins,
			this.conditions,
			List(groups),
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public sort(...fields: FieldDirection<I>[]): QueryAggregate<F, I> {
		return new QueryAggregate(
			this.fields,
			this.collection,
			this.joins,
			this.conditions,
			this.groups,
			List(fields),
			this.limit,
			this.offset
		);
	}

	public range({ limit, offset }: { limit?: number; offset?: number }): QueryAggregate<F, I> {
		if (limit !== this.limit || offset !== this.offset) {
			return new QueryAggregate(
				this.fields,
				this.collection,
				this.joins,
				this.conditions,
				this.groups,
				this.sorts,
				limit !== undefined ? limit : this.limit,
				offset !== undefined ? offset : this.offset
			);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}SELECT `;

		if (this.fields) {
			query += this.fields.map<string>(field => (field ? field.toString() : ``)).join(', ');
		} else {
			query += `*`;
		}

		if (this.collection) {
			query += `${newline}${indent}FROM ${this.collection.toString()}`;
		}

		if (this.joins) {
			query += this.joins
				.map<string>(join => {
					if (join) {
						return `${newline}${indent}JOIN (${join.query.toString()}) AS ${
							join.alias
						} ON ${join.on.toString()}`;
					}
					return '';
				})
				.join('');
		}

		if (this.conditions) {
			query += `${newline}${indent}WHERE ${this.conditions.toString()}`;
		}

		if (this.groups) {
			query += `${newline}${indent}GROUP BY ${this.groups.map<string>(s => (s ? s.toString() : '')).join(', ')}`;
		}

		if (this.sorts) {
			query += `${newline}${indent}SORT BY ${this.sorts.map<string>(s => (s ? s.toString() : '')).join(', ')}`;
		}

		if (this.offset !== undefined) {
			query += `${newline}${indent}OFFSET ${this.offset}`;
		}

		if (this.limit !== undefined) {
			query += `${newline}${indent}LIMIT ${this.limit}`;
		}

		return query;
	}
}

export class QueryUnion<F = any, I = any> extends Query {
	// @ts-ignore
	private type: 'union';

	constructor(
		public readonly selects?: List<QuerySelect<F, I>>,
		public readonly sorts?: List<FieldDirection<I>>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public add(select: QuerySelect<F, I>): QueryUnion<F, I> {
		return new QueryUnion(
			this.selects ? this.selects.push(select) : List([select]),
			this.sorts,
			this.limit,
			this.offset
		);
	}

	public sort(...fields: FieldDirection<I>[]): QueryUnion<F, I> {
		return new QueryUnion(this.selects, List(fields), this.limit, this.offset);
	}

	public range({ limit, offset }: { limit?: number; offset?: number }): QueryUnion<F, I> {
		if (limit !== this.limit || offset !== this.offset) {
			return new QueryUnion(
				this.selects,
				this.sorts,
				limit !== undefined ? limit : this.limit,
				offset !== undefined ? offset : this.offset
			);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';

		if (this.selects) {
			let query = `(${newline}${this.selects
				.map<string>(s => (s ? s.toString(!!multiline, `${indent}\t`) : ''))
				.join(`${newline}) UNION (${newline}`)}${newline})`;

			if (this.sorts) {
				query += `${newline}${indent}SORT BY ${this.sorts
					.map<string>(s => (s ? s.toString() : ''))
					.join(', ')}`;
			}

			if (this.offset !== undefined) {
				query += `${newline}${indent}OFFSET ${this.offset}`;
			}

			if (this.limit !== undefined) {
				query += `${newline}${indent}LIMIT ${this.limit}`;
			}

			return query;
		}
		return '';
	}
}

export type Object<T = any> = Map<string, Value<T>>;

export class QueryInsert<T = any> extends Query {
	// @ts-ignore
	private type: 'insert';

	constructor(public readonly objects?: List<T>, public readonly collection?: Collection) {
		super();
	}

	public add(object: T): QueryInsert<T> {
		return new QueryInsert(this.objects ? this.objects.push(object) : List([object]), this.collection);
	}

	public into(name: string | Collection): QueryInsert<T> {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryInsert(this.objects, renamed);
			}
		} else if (name !== this.collection) {
			return new QueryInsert(this.objects, name);
		}
		return this;
	}

	public toString(multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}INSERT `;

		if (this.collection) {
			query += this.collection.toString();
		}

		if (this.objects && this.objects.count() > 0) {
			const keys = Object.keys(this.objects.get(0));
			query += `${newline}${indent}(${keys.map<string>(key => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES ${this.objects
				.map<string>(obj => {
					return `(${keys
						.map(key => {
							// @ts-ignore
							const value = obj![key];
							if (typeof value === 'string') {
								return `"${value}"`;
							}
							return `${value}`;
						})
						.join(', ')})`;
				})
				.join(', ')}`;
		}

		return query;
	}
}

export class QueryUpdate<T = any, I = any> extends Query {
	// @ts-ignore
	private type: 'update';

	constructor(
		public readonly object?: T,
		public readonly collection?: Collection,
		public readonly conditions?: Binary<I>
	) {
		super();
	}

	public from(name: string | Collection): QueryUpdate<T> {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryUpdate(this.object, renamed, this.conditions);
			}
		} else if (name !== this.collection) {
			return new QueryUpdate(this.object, name, this.conditions);
		}
		return this;
	}

	public set(object: T): QueryUpdate<T> {
		return new QueryUpdate(object, this.collection, this.conditions);
	}

	public where(condition: BinaryExpression<I>): QueryUpdate<T> {
		return new QueryUpdate(
			this.object,
			this.collection,
			condition instanceof Comparison ? new Binary('and', List([condition])) : condition
		);
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}UPDATE `;

		if (this.collection) {
			query += this.collection.toString();
		}

		if (this.object) {
			const keys = Object.keys(this.object);
			query += `${newline}${indent}(${keys.map<string>(key => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES (${keys
				.map<string>(key => {
					// @ts-ignore
					const value = this.object![key];
					if (typeof value === 'string') {
						return `"${value}"`;
					}
					return `${value}`;
				})
				.join(', ')})`;
		}

		if (this.where) {
			query += `${newline}${indent}WHERE ${this.where.toString()}`;
		}

		return query;
	}
}

export class QueryDelete<I = any> extends Query {
	// @ts-ignore
	private type: 'delete';

	constructor(public readonly collection?: Collection, public readonly conditions?: Binary<I>) {
		super();
	}

	public from(name: string | Collection): QueryDelete<I> {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryDelete(renamed, this.conditions);
			}
		} else if (name !== this.collection) {
			return new QueryDelete(name, this.conditions);
		}
		return this;
	}

	public where(condition: BinaryExpression<I>): QueryDelete<I> {
		return new QueryDelete(
			this.collection,
			condition instanceof Comparison ? new Binary('and', List([condition])) : condition
		);
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}DELETE `;

		if (this.collection) {
			query += this.collection.toString();
		}

		if (this.where) {
			query += `${newline}${indent}WHERE ${this.where.toString()}`;
		}

		return query;
	}
}

export class QueryShowCollection extends Query {
	// @ts-ignore
	private type: 'showcollection';

	toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const query = `${indent}SHOW COLLECTIONS`;

		return query;
	}
}

export class QueryCollectionExists extends Query {
	// @ts-ignore
	private type: 'collectionexists';

	constructor(public readonly collection: Collection) {
		super();
	}

	public rename(name: string | Collection): QueryCollectionExists {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryCollectionExists(renamed);
			}
		} else if (name !== this.collection) {
			return new QueryCollectionExists(name);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let query = `${indent}COLLECTION EXISTS `;

		if (this.collection) {
			query += this.collection.toString();
		}

		return query;
	}
}

export class QueryDescribeCollection extends Query {
	// @ts-ignore
	private type: 'describecollection';

	constructor(public readonly collection: Collection) {
		super();
	}

	public rename(name: string | Collection): QueryDescribeCollection {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryDescribeCollection(renamed);
			}
		} else if (name !== this.collection) {
			return new QueryDescribeCollection(name);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let query = `${indent}DESCRIBE COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		return query;
	}
}

export class QueryCreateCollection extends Query {
	// @ts-ignore
	private type: 'createcollection';

	constructor(
		public readonly collection: Collection,
		public readonly columns?: List<Column>,
		public readonly indexes?: List<Index>
	) {
		super();
	}

	public rename(name: string | Collection): QueryCreateCollection {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryCreateCollection(renamed, this.columns, this.indexes);
			}
		} else if (name !== this.collection) {
			return new QueryCreateCollection(name, this.columns, this.indexes);
		}
		return this;
	}

	public define(columns: Column[], indexes: Index[]): QueryCreateCollection {
		return new QueryCreateCollection(this.collection, List(columns), List(indexes));
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}CREATE COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		query += ` (`;

		if (this.columns) {
			query += `${newline}${indent}${this.columns
				.map<string>(c => (c ? c.toString() : ''))
				.join(`,${newline}${indent}`)}`;
		}

		query += `${newline}${indent})`;

		if (this.indexes) {
			query += ` ${newline}${indent}INDEXES (`;
			query += `${newline}${indent}${this.indexes
				.map<string>(i => (i ? i.toString() : ''))
				.join(`,${newline}${indent}`)}`;
			query += `${newline}${indent})`;
		}

		return query;
	}
}

export type ChangeAddColumn = {
	type: 'addColumn';
	column: Column;
	copyColumn?: string;
};
export type ChangeAlterColumn = {
	type: 'alterColumn';
	oldColumn: string;
	newColumn: Column;
};
export type ChangeDropColumn = {
	type: 'dropColumn';
	column: string;
};
export type ChangeAddIndex = {
	type: 'addIndex';
	index: Index;
};
export type ChangeDropIndex = {
	type: 'dropIndex';
	index: string;
};

export type Change = ChangeAddColumn | ChangeAlterColumn | ChangeDropColumn | ChangeAddIndex | ChangeDropIndex;

export class QueryAlterCollection extends Query {
	// @ts-ignore
	private type: 'altercollection';

	constructor(
		public readonly collection: Collection,
		public readonly renamed?: Collection,
		public readonly changes?: List<Change>
	) {
		super();
	}

	public rename(name: string | Collection): QueryAlterCollection {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryAlterCollection(this.collection, renamed, this.changes);
			}
		} else if (name !== this.collection) {
			return new QueryAlterCollection(this.collection, name, this.changes);
		}
		return this;
	}

	public addColumn(column: Column, copyColumn?: string): QueryAlterCollection {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(
			this.collection,
			this.renamed,
			changes.push({ column, copyColumn, type: 'addColumn' })
		);
	}

	public alterColumn(oldColumn: string, newColumn: Column): QueryAlterCollection {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(
			this.collection,
			this.renamed,
			changes.push({ oldColumn, newColumn, type: 'alterColumn' })
		);
	}

	public dropColumn(column: string): QueryAlterCollection {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ column, type: 'dropColumn' }));
	}

	public addIndex(index: Index): QueryAlterCollection {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ index, type: 'addIndex' }));
	}

	public dropIndex(index: string): QueryAlterCollection {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ index, type: 'dropIndex' }));
	}

	public toString(multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		const newline = multiline ? `\n` : ' ';
		let query = `${indent}ALTER COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		query += ` (`;

		if (this.changes) {
			query += `${newline}${indent}${this.changes
				.map<string>(c => {
					if (c && c.type === 'addColumn') {
						return `ADDCOL ${c.column.toString()}`;
					} else if (c && c.type === 'alterColumn') {
						return `ALTERCOL ${c.oldColumn} AS ${c.newColumn.toString()}`;
					} else if (c && c.type === 'dropColumn') {
						return `DROPCOL ${c.column}`;
					} else if (c && c.type === 'addIndex') {
						return `ADDIDX ${c.index.toString()}`;
					} else if (c && c.type === 'dropIndex') {
						return `DROPIDX ${c.index}`;
					} else {
						return '';
					}
				})
				.join(`,${newline}${indent}`)}`;
		}

		query += `${newline}${indent})`;

		if (this.renamed) {
			query += ` AS ${this.renamed.toString()}`;
		}

		return query;
	}
}

export class QueryDropCollection extends Query {
	// @ts-ignore
	private type: 'dropcollection';

	constructor(public readonly collection: Collection) {
		super();
	}

	public rename(name: string | Collection): QueryDropCollection {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryDropCollection(renamed);
			}
		} else if (name !== this.collection) {
			return new QueryDropCollection(name);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let query = `${indent}DROP COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		return query;
	}
}
