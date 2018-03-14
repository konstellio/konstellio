import * as assert from 'assert';
import { Map, List, Record, Iterable } from 'immutable';
import { isArray } from 'util';

export class q {

	public static select(...fields: (string | Field)[]) {
		return new QuerySelect().select(...fields);
	}

	public static aggregate(...fields: (Field | FieldAs)[]) {
		return new QueryAggregate(List(fields));
	}

	public static union(...selects: QuerySelect[]) {
		return new QueryUnion(List(selects));
	}

	public static insert(name: string | Collection) {
		return new QueryInsert().into(name);
	}

	public static update(name: string | Collection) {
		return new QueryUpdate().from(name)
	}

	public static delete(name: string | Collection) {
		return new QueryDelete().from(name);
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

	public static field(name: string, alias?: string) {
		return new Field(name, alias);
	}

	public static sort(field: string | Field, direction: Direction = 'asc') {
		return new FieldDirection(typeof field === 'string' ? new Field(field) : field, direction);
	}

	public static as(field: string | Field | Function, alias: string) {
		return new FieldAs(typeof field === 'string' ? new Field(field) : field, alias);
	}

	public static count(field: string | Field) {
		return new FunctionCount(List([typeof field === 'string' ? new Field(field) : field]));
	}

	public static avg(...args: Value[]) {
		return new FunctionAvg(List<Value>(args));
	}

	public static sum(...args: Value[]) {
		return new FunctionSum(List<Value>(args));
	}

	public static sub(...args: Value[]) {
		return new FunctionSub(List<Value>(args));
	}

	public static max(...args: Value[]) {
		return new FunctionMax(List<Value>(args));
	}

	public static min(...args: Value[]) {
		return new FunctionMin(List<Value>(args));
	}

	public static concat(...args: Value[]) {
		return new FunctionConcat(List<Value>(args));
	}

	public static eq(field: string | Field | Function, value: Value) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonEqual(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static ne(field: string | Field | Function, value: Value) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonNotEqual(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static gt(field: string | Field | Function, value: Value) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonGreaterThan(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static gte(field: string | Field | Function, value: Value) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonGreaterThanOrEqual(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static lt(field: string | Field | Function, value: Value) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonLesserThan(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static lte(field: string | Field | Function, value: Value) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonLesserThanOrEqual(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static in(field: string | Field | Function, values: Value[]) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(isArray(values) && values.length > 0);

		return new ComparisonIn(typeof field === 'string' ? new Field(field) : field, List(values));
	}

	public static beginsWith(field: string | Field | Function, value: string) {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(value !== undefined);

		return new ComparisonBeginsWith(typeof field === 'string' ? new Field(field) : field, List([value]));
	}

	public static and(...operands: BinaryExpression[]) {
		assert(operands.length > 0 && operands.filter(op => (op instanceof Binary || op instanceof Comparison) === false).length === 0);

		return new Binary("and", List(operands));
	}

	public static or(...operands: BinaryExpression[]) {
		assert(operands.length > 0 && operands.filter(op => (op instanceof Binary || op instanceof Comparison) === false).length === 0);

		return new Binary("or", List(operands));
	}

	public static xor(...operands: BinaryExpression[]) {
		assert(operands.length > 0 && operands.filter(op => (op instanceof Binary || op instanceof Comparison) === false).length === 0);

		return new Binary("xor", List(operands));
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

	public toString() {
		return `${this.namespace ? this.namespace + '__' : ''}${this.name}`;
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
	DateTime = 'datetime'
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
		return this.name === column.name && this.type === column.type && this.size === column.size && this.defaultValue === column.defaultValue && this.autoIncrement === column.autoIncrement;
	}

	public toString() {
		return `${this.name} ${this.type.toString().toUpperCase()}${this.size ? `(${this.size})` : ''}${this.defaultValue ? ` DEFAULT(${this.defaultValue})` : ''}${this.autoIncrement === true ? ' AUTOINCREMENT' : ''}`;
	}
}

export enum IndexType {
	Primary = 'primary',
	Unique = 'unique',
	Index = 'index'
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

	public add(...columns: FieldDirection[]) {
		assert(columns.length > 0);
		assert(columns.filter(column => (column instanceof FieldDirection) === false).length === 0);

		return new Index(this.name, this.type, this.columns.push(...columns));
	}

	public equal(index: Index): boolean {
		return this.name === index.name && this.type === index.type && this.columns === index.columns;
	}

	public toString() {
		return `${this.type.toString().toLocaleUpperCase()} ${this.name} (${this.columns.map(c => c ? c.toString() : '').join(', ')})`;
	}
}

export type Primitive = string | number | boolean | Date | null;
export type Value = Variable | Field | Function | Primitive;
export type Variables = { [key: string]: Primitive };

export class Variable {
	constructor(public readonly name: string) {
		assert(typeof name === 'string');
	}

	public equal(variable: Variable): boolean {
		return this.name === variable.name;
	}

	public toString() {
		return `VAR(${this.name})`;
	}
}

export class Field {

	constructor(public readonly name: string, public readonly alias?: string) {
		assert(typeof name === 'string');
		assert(alias === undefined || typeof alias === 'string');
	}

	public rename(name: string, alias?: string) {
		assert(typeof name === 'string');
		assert(alias === undefined || typeof alias === 'string');

		if (name !== this.name || alias !== this.alias) {
			return new Field(name, alias || this.alias);
		}
		return this;
	}

	public equal(field: Field): boolean {
		return this.name === field.name && this.alias === field.alias;
	}

	public toString() {
		return `${this.alias ? this.alias + '.' : ''}${this.name}`;
	}
}

export type Direction = 'asc' | 'desc';

export class FieldDirection {
	constructor(public readonly field: Field, public readonly direction: Direction = 'asc') {
		assert(field instanceof Field);
		assert(direction === 'asc' || direction === 'desc');
	}

	public sort(direction: Direction) {
		assert(direction === 'asc' || direction === 'desc');

		if (direction !== this.direction) {
			return new FieldDirection(this.field, direction);
		}
		return this;
	}

	public rename(name: Field): FieldDirection
	public rename(name: string, alias?: string): FieldDirection
	public rename(name: string | Field, alias?: string): FieldDirection {
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

	public toString() {
		return `${this.field.toString()} ${this.direction.toUpperCase()}`;
	}
}

export abstract class Function {
	constructor(
		public readonly fn: string,
		public readonly args: List<Value> = List()
	) {
		assert(typeof fn === 'string');
		assert(args instanceof List);
	}

	public replaceArgument(replacer: (arg: Value) => undefined | Value) {
		assert(typeof replacer === 'function');
		
		let args = List<Value>();
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

	public toString() {
		return `${this.fn.toUpperCase()}(${this.args.map(arg => arg && arg.toString()).join(', ')})`;
	}
}

export class FunctionCount extends Function {
	constructor(args: List<Value>) {
		super('count', args);
	}
}

export class FunctionAvg extends Function {
	constructor(args: List<Value>) {
		super('avg', args);
	}
}

export class FunctionSum extends Function {
	constructor(args: List<Value>) {
		super('sum', args);
	}
}

export class FunctionSub extends Function {
	constructor(args: List<Value>) {
		super('sub', args);
	}
}

export class FunctionMax extends Function {
	constructor(args: List<Value>) {
		super('max', args);
	}
}

export class FunctionMin extends Function {
	constructor(args: List<Value>) {
		super('min', args);
	}
}

export class FunctionConcat extends Function {
	constructor(args: List<Value>) {
		super('concat', args);
	}
}

export class FieldAs {
	constructor(public readonly field: Field | Function, public readonly alias: string) {
		assert(field instanceof Field || field instanceof Function);
		assert(typeof alias === 'string');
	}

	public set(field: Field | Function, alias: string): FieldAs {
		assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
		assert(typeof alias === 'string');

		if (this.field !== field || this.alias !== alias) {
			return new FieldAs(field, alias);
		}
		return this;
	}

	public equal(field: FieldAs): boolean {
		return this.field === field.field && this.alias === field.alias;
	}

	public toString() {
		return `${this.field.toString()} AS ${this.alias}`;
	}
}

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'beginsWith' | 'in';

export abstract class Comparison {
	constructor(
		public readonly field: Field | Function,
		public readonly operator: ComparisonOperator,
		public readonly args: List<Value> = List()
	) {
		assert(field instanceof Field || field instanceof Function);
		assert(operator === '=' || operator === '!=' || operator === '>' || operator === '>=' || operator === '<' || operator === '<=' || operator === 'beginsWith' || operator === 'in');
		assert(args instanceof List);
	}

	public rename(name: Field | Function): Comparison
	public rename(name: string, alias?: string): Comparison
	public rename(name: string | Field | Function, alias?: string): Comparison {
		assert(typeof name === 'string' || name instanceof Field);
		assert(alias === undefined || typeof alias === 'string');

		const constructor = this.constructor as any;
		if (name instanceof Field || name instanceof Function) {
			return new constructor(name, this.args);
		}
		else {
			if (this.field instanceof Field) {
				return new constructor(new Field(name), this.args);
			}
			else {
				const renameArg = (arg) => {
					if (arg instanceof Field) {
						return arg.rename(name);
					}
					else if (arg instanceof Function) {
						return arg.replaceArgument(renameArg);
					}
					return arg;
				}
				const renamed = this.field.replaceArgument(renameArg);
				if (renamed !== this.field) {
					return new constructor(renamed, this.args);
				}
			}
		}
		return this;
	}

	public replaceArgument(replacer: (arg: Value) => undefined | Value) {
		assert(typeof replacer === 'function');

		let args = List<Value>();
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

	public equal(comparison: Comparison): boolean {
		return this.field === comparison.field && this.operator === comparison.operator && this.args === comparison.args;
	}

	public toString(): string {
		return `${this.field.toString()} ${this.operator} ${this.args.map(arg => arg ? arg.toString() : 'NULL').join(', ')}`;
	}
}

export class ComparisonEqual extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, '=', args);
	}
}

export class ComparisonNotEqual extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, '!=', args);
	}
}

export class ComparisonGreaterThan extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, '>', args);
	}
}

export class ComparisonGreaterThanOrEqual extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, '>=', args);
	}
}

export class ComparisonLesserThan extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, '<', args);
	}
}

export class ComparisonLesserThanOrEqual extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, '<=', args);
	}
}

export class ComparisonBeginsWith extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, 'beginsWith', args);
	}
}

export class ComparisonIn extends Comparison {
	constructor(field: Field | Function, args: List<Value>) {
		super(field, 'in', args);
	}
}

export type BinaryOperator = 'and' | 'or' | 'xor';
export type BinaryExpression = Binary | Comparison;

export class Binary {
	constructor(
		public readonly operator: BinaryOperator,
		public readonly operands: List<BinaryExpression> = List()
	) {
		assert(operator === 'and' || operator === 'or' || operator === 'xor');
		assert(operands instanceof List);
	}
	
	public isLeaf() {
		return this.operands.filter(op => op instanceof Binary).count() === 0;
	}

	public add(expr: BinaryExpression) {
		assert(expr instanceof Binary || expr instanceof Comparison);

		return new Binary(this.operator, this.operands.push(expr));
	}

	public remove(expr: BinaryExpression) {
		assert(expr instanceof Binary || expr instanceof Comparison);

		if (this.operands.contains(expr)) {
			return new Binary(this.operator, this.operands.filter(op => op !== expr).toList());
		}
		return this;
	}

	public replace(search: BinaryExpression, replace: BinaryExpression, deep: boolean = false) {
		assert(search instanceof Binary || search instanceof Comparison);
		assert(replace instanceof Binary || replace instanceof Comparison);
		assert(typeof deep === 'boolean');

		return this.visit((op) => {
			if (op === search) {
				return replace;
			}
			return op;
		}, deep);
	}

	public visit(visiter: (op: BinaryExpression) => undefined | BinaryExpression, deep: boolean = false) {
		assert(typeof visiter === 'function');
		assert(typeof deep === 'boolean');

		let operands = List<BinaryExpression>();
		let changed = false;

		this.operands.forEach(arg => {
			const replaced = visiter(arg!);
			if (replaced) {
				changed = changed || arg !== replaced;
				operands = operands.push(replaced);
			}
			else if (deep === true && arg instanceof Binary) {
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
			return new Binary(this.operator, operands);
		}
		return this;
	}

	public equal(binary: Binary): boolean {
		return this.operator === binary.operator && this.operands === binary.operands;
	}

	public toString() {
		return `(${this.operands.map(op => op!.toString()).join(` ${this.operator.toUpperCase()} `)})`;
	}
}

export class Query {}

export type Join = {
	alias: string
	on: BinaryExpression
	query: QuerySelect
}

export class QuerySelect extends Query {
	private type: 'select';

	constructor(
		public readonly fields?: List<Field | FieldAs>,
		public readonly collection?: Collection,
		public readonly joins?: List<Join>,
		public readonly conditions?: Binary,
		public readonly sorts?: List<FieldDirection>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public select(...fields: (string | Field | FieldAs)[]) {
		return new QuerySelect(List(fields.map<Field | FieldAs>(field => typeof field === 'string' ? new Field(field) : field)), this.collection, this.joins, this.conditions, this.sorts, this.limit, this.offset);
	}

	public from(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QuerySelect(this.fields, renamed, this.joins, this.conditions, this.sorts, this.limit, this.offset);
			}
		}
		else if (name !== this.collection) {
			return new QuerySelect(this.fields, name, this.joins, this.conditions, this.sorts, this.limit, this.offset);
		}
		return this;
	}

	public join(alias: string, query: QuerySelect, on: BinaryExpression) {
		const join: Join = { alias, query, on };
		return new QuerySelect(this.fields, this.collection, this.joins ? this.joins.push(join) : List(join), this.conditions, this.sorts, this.limit, this.offset);
	}

	public where(condition: BinaryExpression) {
		return new QuerySelect(this.fields, this.collection, this.joins, condition instanceof Comparison ? new Binary('and', List([condition])) : condition, this.sorts, this.limit, this.offset);
	}

	public sort(...fields: FieldDirection[]) {
		return new QuerySelect(this.fields, this.collection, this.joins, this.conditions, List(fields), this.limit, this.offset);
	}

	public range({ limit, offset }: { limit?: number, offset?: number }) {
		if (limit !== this.limit || offset !== this.offset) {
			return new QuerySelect(this.fields, this.collection, this.joins, this.conditions, this.sorts, limit !== undefined ? limit : this.limit, offset !== undefined ? offset : this.offset);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}SELECT `;

		if (this.fields) {
			query += this.fields.map<string>(field => field ? field.toString() : ``).join(', ');
		} else {
			query += `*`;
		}

		if (this.collection) {
			query += `${newline}${indent}FROM ${this.collection.toString()}`;
		}

		if (this.joins) {
			query += this.joins.map<string>(join => {
				if (join) {
					return `${newline}${indent}JOIN (${join.query.toString()}) AS ${join.alias} ON ${join.on.toString()}`;
				}
				return '';
			}).join('');
		}

		if (this.conditions) {
			query += `${newline}${indent}WHERE ${this.conditions.toString()}`;
		}

		if (this.sorts) {
			query += `${newline}${indent}SORT BY ${this.sorts.map<string>(s => s ? s.toString() : '').join(', ')}`;
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

export class QueryAggregate extends Query {
	private type: 'aggregate';

	constructor(
		public readonly fields?: List<Field | FieldAs>,
		public readonly collection?: Collection,
		public readonly joins?: List<Join>,
		public readonly conditions?: Binary,
		public readonly groups?: List<Field | Function>,
		public readonly sorts?: List<FieldDirection>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public select(...fields: (Field | FieldAs)[]) {
		return new QueryAggregate(List(fields), this.collection, this.joins, this.conditions, this.groups, this.sorts, this.limit, this.offset);
	}

	public from(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryAggregate(this.fields, renamed, this.joins, this.conditions, this.groups, this.sorts, this.limit, this.offset);
			}
		}
		else if (name !== this.collection) {
			return new QueryAggregate(this.fields, name, this.joins, this.conditions, this.groups, this.sorts, this.limit, this.offset);
		}
		return this;
	}

	public join(alias: string, query: QuerySelect, on: BinaryExpression) {
		const join: Join = { alias, query, on };
		return new QueryAggregate(this.fields, this.collection, this.joins ? this.joins.push(join) : List([join]), this.conditions, this.groups, this.sorts, this.limit, this.offset);
	}

	public where(condition: BinaryExpression) {
		return new QueryAggregate(this.fields, this.collection, this.joins, condition instanceof Comparison ? new Binary('and', List([condition])) : condition, this.groups, this.sorts, this.limit, this.offset);
	}

	public group(...groups: (Field | Function)[]) {
		return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, List(groups), this.sorts, this.limit, this.offset);
	}

	public sort(...fields: FieldDirection[]) {
		return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, this.groups, List(fields), this.limit, this.offset);
	}

	public range({ limit, offset }: { limit?: number, offset?: number }) {
		if (limit !== this.limit || offset !== this.offset) {
			return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, this.groups, this.sorts, limit !== undefined ? limit : this.limit, offset !== undefined ? offset : this.offset);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}SELECT `;

		if (this.fields) {
			query += this.fields.map<string>(field => field ? field.toString() : ``).join(', ');
		} else {
			query += `*`;
		}

		if (this.collection) {
			query += `${newline}${indent}FROM ${this.collection.toString()}`;
		}

		if (this.joins) {
			query += this.joins.map<string>(join => {
				if (join) {
					return `${newline}${indent}JOIN (${join.query.toString()}) AS ${join.alias} ON ${join.on.toString()}`;
				}
				return '';
			}).join('');
		}

		if (this.conditions) {
			query += `${newline}${indent}WHERE ${this.conditions.toString()}`;
		}

		if (this.groups) {
			query += `${newline}${indent}GROUP BY ${this.groups.map<string>(s => s ? s.toString() : '').join(', ')}`;
		}

		if (this.sorts) {
			query += `${newline}${indent}SORT BY ${this.sorts.map<string>(s => s ? s.toString() : '').join(', ')}`;
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

export class QueryUnion extends Query {
	private type: 'union';

	constructor(
		public readonly selects?: List<QuerySelect>,
		public readonly sorts?: List<FieldDirection>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public add(select: QuerySelect) {
		return new QueryUnion(this.selects ? this.selects.push(select) : List([select]), this.sorts, this.limit, this.offset);
	}

	public sort(...fields: FieldDirection[]) {
		return new QueryUnion(this.selects, List(fields), this.limit, this.offset);
	}

	public range({ limit, offset }: { limit?: number, offset?: number }) {
		if (limit !== this.limit || offset !== this.offset) {
			return new QueryUnion(this.selects, this.sorts, limit !== undefined ? limit : this.limit, offset !== undefined ? offset : this.offset);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';

		if (this.selects) {
			let query = `(${newline}${this.selects.map<string>(s => s ? s.toString(!!multiline, `${indent}\t`) : '').join(`${newline}) UNION (${newline}`)}${newline})`;

			if (this.sorts) {
				query += `${newline}${indent}SORT BY ${this.sorts.map<string>(s => s ? s.toString() : '').join(', ')}`;
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

export type Object = Map<string, Value>;

export class QueryInsert extends Query {
	private type: 'insert';

	constructor(
		public readonly objects?: List<Object>,
		public readonly collection?: Collection
	) {
		super();
	}

	public add(object: Object | { [field: string]: Value }) {
		const map = Map<string, Value>(object);
		return new QueryInsert(this.objects ? this.objects.push(map) : List([map]), this.collection);
	}

	public into(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryInsert(this.objects, renamed);
			}
		}
		else if (name !== this.collection) {
			return new QueryInsert(this.objects, name);
		}
		return this;
	}

	public toString(multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}INSERT `;

		if (this.collection) {
			query += this.collection.toString();
		}

		if (this.objects && this.objects.count() > 0) {
			const keys = Array.from<string>(this.objects.get(0).keys() as any);
			query += `${newline}${indent}(${keys.map<string>(key => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES ${this.objects.map<string>(obj => {
				return `(${keys.map(key => {
					const value = obj!.get(key);
					if (typeof value === 'string') {
						return `"${value}"`;
					}
					return `${value}`;
				}).join(', ')})`;
			}).join(', ')}`;
		}

		return query;
	}
}

export class QueryUpdate extends Query {
	private type: 'update';

	constructor(
		public readonly object?: Object,
		public readonly collection?: Collection,
		public readonly conditions?: Binary
	) {
		super();
	}

	public from(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryUpdate(this.object, renamed, this.conditions);
			}
		}
		else if (name !== this.collection) {
			return new QueryUpdate(this.object, name, this.conditions);
		}
		return this;
	}

	public set(object: Object | { [field: string]: Value }) {
		const map: Object = Map<string, Value>(object);
		return new QueryUpdate(map, this.collection, this.conditions);
	}

	public where(condition: BinaryExpression) {
		return new QueryUpdate(this.object, this.collection, condition instanceof Comparison ? new Binary('and', List([condition])) : condition);
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}UPDATE `;

		if (this.collection) {
			query += this.collection.toString();
		}

		if (this.object) {
			const keys = Object.keys(this.object);
			query += `${newline}${indent}(${keys.map<string>(key => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES (${keys.map<string>(key => {
				const value = this.object![key];
				if (typeof value === 'string') {
					return `"${value}"`;
				}
				return `${value}`;
			}).join(', ')})`;
		}

		if (this.where) {
			query += `${newline}${indent}WHERE ${this.where.toString()}`;
		}

		return query;
	}
}

export class QueryDelete extends Query {
	private type: 'delete';

	constructor(
		public readonly collection?: Collection,
		public readonly conditions?: Binary
	) {
		super();
	}

	public from(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryDelete(renamed, this.conditions);
			}
		}
		else if (name !== this.collection) {
			return new QueryDelete(name, this.conditions);
		}
		return this;
	}

	public where(condition: BinaryExpression) {
		return new QueryDelete(this.collection, condition instanceof Comparison ? new Binary('and', List([condition])) : condition);
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
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
	private type: 'showcollection';

	toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}SHOW COLLECTIONS`;

		return query;
	}
}

export class QueryCollectionExists extends Query {
	private type: 'collectionexists';

	constructor(
		public readonly collection: Collection
	) {
		super();
	}

	public rename(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryCollectionExists(renamed);
			}
		}
		else if (name !== this.collection) {
			return new QueryCollectionExists(name);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}COLLECTION EXISTS `;

		if (this.collection) {
			query += this.collection.toString();
		}

		return query;
	}
}

export class QueryDescribeCollection extends Query {
	private type: 'describecollection';

	constructor(
		public readonly collection: Collection
	) {
		super();
	}

	public rename(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryDescribeCollection(renamed);
			}
		}
		else if (name !== this.collection) {
			return new QueryDescribeCollection(name);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}DESCRIBE COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		return query;
	}
}

export class QueryCreateCollection extends Query {
	private type: 'createcollection';

	constructor(
		public readonly collection: Collection,
		public readonly columns?: List<Column>,
		public readonly indexes?: List<Index>
	) {
		super();
	}

	public rename(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryCreateCollection(renamed, this.columns, this.indexes);
			}
		}
		else if (name !== this.collection) {
			return new QueryCreateCollection(name, this.columns, this.indexes);
		}
		return this;
	}

	public define(columns: Column[], indexes: Index[]) {
		return new QueryCreateCollection(this.collection, List(columns), List(indexes));
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}CREATE COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		query += ` (`;


		if (this.columns) {
			query += `${newline}${indent}${this.columns.map<string>(c => c ? c.toString() : '').join(`,${newline}${indent}`)}`;
		}

		query += `${newline}${indent})`;

		if (this.indexes) {
			query += ` ${newline}${indent}INDEXES (`;
			query += `${newline}${indent}${this.indexes.map<string>(i => i ? i.toString() : '').join(`,${newline}${indent}`)}`;
			query += `${newline}${indent})`;
		}

		return query;
	}
}

export type ChangeAddColumn = {
	type: 'addColumn'
	column: Column
	copyColumn?: string
}
export type ChangeAlterColumn = {
	type: 'alterColumn'
	oldColumn: string
	newColumn: Column
}
export type ChangeDropColumn = {
	type: 'dropColumn'
	column: string
}
export type ChangeAddIndex = {
	type: 'addIndex'
	index: Index
}
export type ChangeDropIndex = {
	type: 'dropIndex'
	index: string
}

export type Change = ChangeAddColumn | ChangeAlterColumn | ChangeDropColumn | ChangeAddIndex | ChangeDropIndex;

export class QueryAlterCollection extends Query {
	private type: 'altercollection';

	constructor(
		public readonly collection: Collection,
		public readonly renamed?: Collection,
		public readonly changes?: List<Change>
	) {
		super();
	}

	public rename(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryAlterCollection(this.collection, renamed, this.changes);
			}
		}
		else if (name !== this.collection) {
			return new QueryAlterCollection(this.collection, name, this.changes);
		}
		return this;
	}

	public addColumn(column: Column, copyColumn?: string) {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'addColumn', column, copyColumn }));
	}

	public alterColumn(oldColumn: string, newColumn: Column) {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'alterColumn', oldColumn, newColumn }));
	}

	public dropColumn(column: string) {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'dropColumn', column }));
	}

	public addIndex(index: Index) {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'addIndex', index }));
	}

	public dropIndex(index: string) {
		const changes = this.changes ? this.changes : List<Change>();
		return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'dropIndex', index }));
	}

	public toString(multiline?: boolean, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}ALTER COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		query += ` (`;

		if (this.changes) {
			query += `${newline}${indent}${this.changes.map<string>(c => {
				if (c && c.type === 'addColumn') {
					return `ADDCOL ${c.column.toString()}`;
				}
				else if (c && c.type === 'alterColumn') {
					return `ALTERCOL ${c.oldColumn} AS ${c.newColumn.toString()}`;
				}
				else if (c && c.type === 'dropColumn') {
					return `DROPCOL ${c.column}`;
				}
				else if (c && c.type === 'addIndex') {
					return `ADDIDX ${c.index.toString()}`;
				}
				else if (c && c.type === 'dropIndex') {
					return `DROPIDX ${c.index}`;
				}
				else {
					return '';
				}
			}).join(`,${newline}${indent}`)}`;
		}

		query += `${newline}${indent})`;

		if (this.renamed) {
			query += ` AS ${this.renamed.toString()}`;
		}

		return query;
	}
}

export class QueryDropCollection extends Query {
	private type: 'dropcollection';

	constructor(
		public readonly collection: Collection
	) {
		super();
	}

	public rename(name: string | Collection) {
		if (typeof name === 'string') {
			const renamed = this.collection ? this.collection.rename(name) : new Collection(name);
			if (renamed !== this.collection) {
				return new QueryDropCollection(renamed);
			}
		}
		else if (name !== this.collection) {
			return new QueryDropCollection(name);
		}
		return this;
	}

	public toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}DROP COLLECTION `;

		if (this.collection) {
			query += this.collection.toString();
		}

		return query;
	}
}