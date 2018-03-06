import * as assert from 'assert';
import { Map, List, Record, Iterable } from 'immutable';

export class q {

	public static select(...fields: Field[]) {
		return new QuerySelect().select(...fields);
	}

	public static aggregate(...fields: Function[]) {
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

	public static column(name: string, type: ColumnType, defaultValue?: any, autoIncrement?: boolean) {
		return new Column(name, type, defaultValue, autoIncrement);
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

	public static count(field: string | Field) {
		return new FunctionCount(List(typeof field === 'string' ? new Field(field) : field));
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

	public static eq(field: Field | Function, value: Value) {
		return new ComparisonEqual(field, List([value]));
	}

	public static ne(field: Field | Function, value: Value) {
		return new ComparisonNotEqual(field, List([value]));
	}

	public static gt(field: Field | Function, value: Value) {
		return new ComparisonGreaterThan(field, List([value]));
	}

	public static gte(field: Field | Function, value: Value) {
		return new ComparisonGreaterThanOrEqual(field, List([value]));
	}

	public static lt(field: Field | Function, value: Value) {
		return new ComparisonLesserThan(field, List([value]));
	}

	public static lte(field: Field | Function, value: Value) {
		return new ComparisonLesserThanOrEqual(field, List([value]));
	}

	public static in(field: Field | Function, values: Value[]) {
		return new ComparisonIn(field, List(values));
	}

	public static beginsWith(field: Field | Function, value: string) {
		return new ComparisonBeginsWith(field, List([value]));
	}

	public static and(...operands: BinaryExpression[]) {
		return new Binary("and", List(operands));
	}

	public static or(...operands: BinaryExpression[]) {
		return new Binary("or", List(operands));
	}

	public static xor(...operands: BinaryExpression[]) {
		return new Binary("xor", List(operands));
	}
}

export class QueryTooComplexeError extends Error {}
export class QueryNotSupportedError extends Error {}
export class QuerySyntaxError extends Error {}

export class Collection {
	constructor(public readonly name: string, public readonly namespace?: string) {

	}

	public rename(name: string, namespace?: string) {
		if (name !== this.name || namespace !== this.namespace) {
			return new Collection(name, namespace || this.namespace);
		}
		return this;
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
	constructor(public readonly name: string, public readonly type: ColumnType, public readonly defaultValue?: any, public readonly autoIncrement: boolean = false) {

	}

	public rename(name: string) {
		if (name !== this.name) {
			return new Column(name, this.type, this.defaultValue, this.autoIncrement);
		}
		return this;
	}

	public toString() {
		return [
			this.name,
			this.type.toString().toLocaleUpperCase(),
			this.defaultValue ? `DEFAULT(${this.defaultValue})` : ``,
			this.autoIncrement ? `AUTOINCREMENT` : ``,
		].filter(s => s).join(' ');
	}
}

export enum IndexType {
	Primary = 'primary',
	Unique = 'unique',
	Index = 'index'
}

export class Index {
	constructor(public readonly name: string, public readonly type: IndexType, public readonly columns: List<FieldDirection> = List()) {

	}

	public add(...columns: FieldDirection[]) {
		return new Index(this.name, this.type, this.columns.push(...columns));
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
	}

	public toString() {
		return `VAR(${this.name})`;
	}
}

export class Field {

	constructor(public readonly name: string, public readonly alias?: string) {

	}

	public rename(name: string, alias?: string) {
		if (name !== this.name || alias !== this.alias) {
			return new Field(name, alias || this.alias);
		}
		return this;
	}

	public toString() {
		return `${this.alias ? this.alias + '.' : ''}${this.name}`;
	}
}

export type Direction = 'asc' | 'desc';

export class FieldDirection {
	constructor(public readonly field: Field, public readonly direction: Direction = 'asc') {

	}

	public sort(direction: Direction) {
		if (direction !== this.direction) {
			return new FieldDirection(this.field, direction);
		}
		return this;
	}

	public rename(name: string, alias?: string) {
		const renamed = this.field.rename(name, alias);
		if (renamed !== this.field) {
			return new FieldDirection(renamed, this.direction);
		}
		return this;
	}

	public toString() {
		return `${this.field.toString()} ${this.direction.toUpperCase()}`;
	}
}

export abstract class Function {
	constructor(public readonly fn: string, public readonly args: List<Value> = List()) {

	}

	public replaceArgument(replacer: (arg: Value) => undefined | Value) {
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
			return this.constructor(args) as this;
		}
		return this;
	}

	public toString() {
		return `${this.fn.toUpperCase()}(${this.args.map(arg => arg && arg.toString()).join(', ')})`;
	}
}

export class FunctionCount extends Function {
	constructor(public readonly fields: List<Value>) {
		super('count', fields);
	}
}

export class FunctionAvg extends Function {
	constructor(public readonly args: List<Value>) {
		super('avg', args);
	}
}

export class FunctionSum extends Function {
	constructor(public readonly args: List<Value>) {
		super('sum', args);
	}
}

export class FunctionSub extends Function {
	constructor(public readonly args: List<Value>) {
		super('sub', args);
	}
}

export class FunctionMax extends Function {
	constructor(public readonly args: List<Value>) {
		super('max', args);
	}
}

export class FunctionMin extends Function {
	constructor(public readonly args: List<Value>) {
		super('min', args);
	}
}

export class FunctionConcat extends Function {
	constructor(public readonly args: List<Value>) {
		super('concat', args);
	}
}

export type ComparisonOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "beginsWith" | "in";

export abstract class Comparison {
	constructor(public readonly field: Field | Function, public readonly operator: ComparisonOperator, public readonly args: List<Value> = List()) {

	}

	public replaceArgument(replacer: (arg: Value) => undefined | Value) {
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
			return this.constructor(this.field, args) as this;
		}
		return this;
	}

	public toString(): string {
		return `${this.field.toString()} ${this.operator} ${this.args.map(arg => arg ? arg.toString() : 'NULL').join(', ')}`;
	}
}

export class ComparisonEqual extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, '=', args);
	}
}

export class ComparisonNotEqual extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, '!=', args);
	}
}

export class ComparisonGreaterThan extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, '>', args);
	}
}

export class ComparisonGreaterThanOrEqual extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, '>=', args);
	}
}

export class ComparisonLesserThan extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, '<', args);
	}
}

export class ComparisonLesserThanOrEqual extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, '<=', args);
	}
}

export class ComparisonBeginsWith extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, 'beginsWith', args);
	}
}

export class ComparisonIn extends Comparison {
	constructor(public readonly field: Field | Function, public readonly args: List<Value>) {
		super(field, 'in', args);
	}
}

export type BinaryOperator = 'and' | 'or' | 'xor';
export type BinaryExpression = Binary | Comparison;

export class Binary {
	constructor(public readonly operator: BinaryOperator, public readonly operands: List<BinaryExpression> = List()) {

	}
	
	public isLeaf() {
		return this.operands.filter(op => op instanceof Binary).count() === 0;
	}

	public add(expr: BinaryExpression) {
		return new Binary(this.operator, this.operands.push(expr));
	}

	public remove(expr: BinaryExpression) {
		if (this.operands.contains(expr)) {
			return new Binary(this.operator, this.operands.filter(op => op !== expr).toList());
		}
		return this;
	}

	public replace(search: BinaryExpression, replace: BinaryExpression, deep: boolean = false) {
		return this.replaceOperand((op) => {
			if (op === search) {
				return replace;
			}
			return op;
		}, deep);
	}

	public replaceOperand(replacer: (op: BinaryExpression) => undefined | BinaryExpression, deep: boolean = false) {
		let operands = List<BinaryExpression>();
		let changed = false;

		this.operands.forEach(arg => {
			const replaced = replacer(arg!);
			if (replaced) {
				changed = changed || arg !== replaced;
				operands = operands.push(replaced);
			}
			else if (deep === true && arg instanceof Binary) {
				const replaced = arg.replaceOperand(replacer, true);
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

	public toString() {
		return `(${this.operands.map(op => op!.toString()).join(` ${this.operator.toUpperCase()} `)})`;
	}
}

export function simplifyBinaryTree(node: Binary) {
	if (node.isLeaf()) {
		return node;
	}

	let simplified = new Binary(node.operator);
	node.operands.forEach(operand => {
		if (operand instanceof Comparison) {
			simplified = simplified.add(operand);
		}
		else if (operand instanceof Binary && operand.operator === node.operator) {
			operand = simplifyBinaryTree(operand);
			if (operand.operands) {
				operand.operands.forEach(operand => {
					simplified = simplified.add(operand!);
				});
			}
		}
		else if (operand instanceof Binary) {
			simplified = simplified.add(simplifyBinaryTree(operand));
		}
	});

	return simplified;
}

export class Query {

}

export type Join = {
	alias: string
	on: BinaryExpression
	query: QuerySelect
}

export class QuerySelect extends Query {
	constructor(
		public readonly fields?: List<Field>,
		public readonly collection?: Collection,
		public readonly joins?: List<Join>,
		public readonly conditions?: Binary,
		public readonly sorts?: List<FieldDirection>,
		public readonly limit?: number,
		public readonly offset = 0
	) {
		super();
	}

	public select(...fields: Field[]) {
		return new QuerySelect(List(fields), this.collection, this.joins, this.conditions, this.sorts, this.limit, this.offset);
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

	public where(condition: Binary) {
		return new QuerySelect(this.fields, this.collection, this.joins, condition, this.sorts, this.limit, this.offset);
	}

	public sort(...fields: FieldDirection[]) {
		return new QuerySelect(this.fields, this.collection, this.joins, this.conditions, List(fields), this.limit, this.offset);
	}

	public range(offset: number, limit?: number) {
		return new QuerySelect(this.fields, this.collection, this.joins, this.conditions, this.sorts, offset, limit !== undefined ? limit : this.limit);
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
	constructor(
		public readonly fields?: List<Function>,
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

	public select(...fields: Function[]) {
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
		return new QueryAggregate(this.fields, this.collection, this.joins ? this.joins.push(join) : List(join), this.conditions, this.groups, this.sorts, this.limit, this.offset);
	}

	public where(condition: Binary) {
		return new QueryAggregate(this.fields, this.collection, this.joins, condition, this.groups, this.sorts, this.limit, this.offset);
	}

	public group(...groups: (Field | Function)[]) {
		return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, List(groups), this.sorts, this.limit, this.offset);
	}

	public sort(...fields: FieldDirection[]) {
		return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, this.groups, List(fields), this.limit, this.offset);
	}

	public range(offset: number, limit?: number) {
		return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, this.groups, this.sorts, offset, limit !== undefined ? limit : this.limit);
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

	public range(offset: number, limit?: number) {
		return new QueryUnion(this.selects, this.sorts, offset, limit !== undefined ? limit : this.limit);
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

export type Object = { [field: string]: Value };

export class QueryInsert extends Query {
	constructor(
		public readonly objects?: List<Object>,
		public readonly collection?: Collection
	) {
		super();
	}

	public add(object: Object) {
		return new QueryInsert(this.objects ? this.objects.push(object) : List([object]), this.collection);
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
			const keys = Object.keys(this.objects.get(0));
			query += `${newline}${indent}(${keys.map<string>(key => key || '').join(', ')})`;
			query += `${newline}${indent}VALUES ${this.objects.map<string>(obj => {
				return `(${keys.map(key => {
					const value = obj![key];
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

	public where(condition: Binary) {
		return new QueryUpdate(this.object, this.collection, condition);
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

	public where(condition: Binary) {
		return new QueryDelete(this.collection, condition);
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
	toString(multiline: boolean = false, indent?: string): string {
		multiline = !!multiline;
		indent = multiline && indent ? indent : '';

		let newline = multiline ? `\n` : ' ';
		let query = `${indent}SHOW COLLECTIONS`;

		return query;
	}
}

export class QueryCollectionExists extends Query {
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

	public alter(columns: Column[], indexes: Index[]) {
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