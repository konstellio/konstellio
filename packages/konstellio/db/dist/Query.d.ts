import { Map, List } from 'immutable';
export declare class q {
    static select(...fields: (string | Field)[]): QuerySelect;
    static aggregate(...fields: (Field | FieldAs)[]): QueryAggregate;
    static union(...selects: QuerySelect[]): QueryUnion;
    static insert(name: string | Collection): QueryInsert;
    static update(name: string | Collection): QueryUpdate;
    static delete(name: string | Collection): QueryDelete;
    static showCollection(): QueryShowCollection;
    static createCollection(name: string | Collection): QueryCreateCollection;
    static describeCollection(name: string | Collection): QueryDescribeCollection;
    static alterCollection(name: string | Collection): QueryAlterCollection;
    static collectionExists(name: string | Collection): QueryCollectionExists;
    static dropCollection(name: string | Collection): QueryDropCollection;
    static collection(name: string, namespace?: string): Collection;
    static column(name: string, type: ColumnType, size?: number, defaultValue?: any, autoIncrement?: boolean): Column;
    static index(name: string, type: IndexType, columns?: FieldDirection[]): Index;
    static var(name: string): Variable;
    static field(name: string, alias?: string): Field;
    static sort(field: string | Field, direction?: Direction): FieldDirection;
    static as(field: string | Field | Function, alias: string): FieldAs;
    static count(field: string | Field): FunctionCount;
    static avg(...args: Value[]): FunctionAvg;
    static sum(...args: Value[]): FunctionSum;
    static sub(...args: Value[]): FunctionSub;
    static max(...args: Value[]): FunctionMax;
    static min(...args: Value[]): FunctionMin;
    static concat(...args: Value[]): FunctionConcat;
    static eq(field: string | Field | Function, value: Value): ComparisonEqual;
    static ne(field: string | Field | Function, value: Value): ComparisonNotEqual;
    static gt(field: string | Field | Function, value: Value): ComparisonGreaterThan;
    static gte(field: string | Field | Function, value: Value): ComparisonGreaterThanOrEqual;
    static lt(field: string | Field | Function, value: Value): ComparisonLesserThan;
    static lte(field: string | Field | Function, value: Value): ComparisonLesserThanOrEqual;
    static in(field: string | Field | Function, values: Value[]): ComparisonIn;
    static beginsWith(field: string | Field | Function, value: string): ComparisonBeginsWith;
    static and(...operands: BinaryExpression[]): Binary;
    static or(...operands: BinaryExpression[]): Binary;
    static xor(...operands: BinaryExpression[]): Binary;
}
export declare class Collection {
    readonly name: string;
    readonly namespace?: string | undefined;
    constructor(name: string, namespace?: string | undefined);
    rename(name: string, namespace?: string): Collection;
    equal(collection: Collection): boolean;
    toString(): string;
}
export declare enum ColumnType {
    Boolean = "boolean",
    Bit = "bit",
    UInt = "uint",
    Int = "int",
    Float = "float",
    Text = "text",
    Blob = "blob",
    Date = "date",
    DateTime = "datetime"
}
export declare class Column {
    readonly name: string;
    readonly type: ColumnType;
    readonly size?: number | undefined;
    readonly defaultValue?: any;
    readonly autoIncrement: boolean;
    constructor(name: string, type: ColumnType, size?: number | undefined, defaultValue?: any, autoIncrement?: boolean);
    rename(name: string): Column;
    resize(size: number): Column;
    equal(column: Column): boolean;
    toString(): string;
}
export declare enum IndexType {
    Primary = "primary",
    Unique = "unique",
    Index = "index"
}
export declare class Index {
    readonly name: string;
    readonly type: IndexType;
    readonly columns: List<FieldDirection>;
    constructor(name: string, type: IndexType, columns?: List<FieldDirection>);
    add(...columns: FieldDirection[]): Index;
    equal(index: Index): boolean;
    toString(): string;
}
export declare type Primitive = string | number | boolean | Date | null;
export declare type Value = Variable | Field | Function | Primitive;
export declare type Variables = {
    [key: string]: Primitive;
};
export declare class Variable {
    readonly name: string;
    constructor(name: string);
    equal(variable: Variable): boolean;
    toString(): string;
}
export declare class Field {
    readonly name: string;
    readonly alias?: string | undefined;
    constructor(name: string, alias?: string | undefined);
    rename(name: string, alias?: string): Field;
    equal(field: Field): boolean;
    toString(): string;
}
export declare type Direction = 'asc' | 'desc';
export declare class FieldDirection {
    readonly field: Field;
    readonly direction: Direction;
    constructor(field: Field, direction?: Direction);
    sort(direction: Direction): FieldDirection;
    rename(name: Field): FieldDirection;
    rename(name: string, alias?: string): FieldDirection;
    equal(field: FieldDirection): boolean;
    toString(): string;
}
export declare abstract class Function {
    readonly fn: string;
    readonly args: List<Value>;
    constructor(fn: string, args?: List<Value>);
    replaceArgument(replacer: (arg: Value) => undefined | Value): this;
    equal(fn: Function): boolean;
    toString(): string;
}
export declare class FunctionCount extends Function {
    constructor(args: List<Value>);
}
export declare class FunctionAvg extends Function {
    constructor(args: List<Value>);
}
export declare class FunctionSum extends Function {
    constructor(args: List<Value>);
}
export declare class FunctionSub extends Function {
    constructor(args: List<Value>);
}
export declare class FunctionMax extends Function {
    constructor(args: List<Value>);
}
export declare class FunctionMin extends Function {
    constructor(args: List<Value>);
}
export declare class FunctionConcat extends Function {
    constructor(args: List<Value>);
}
export declare class FieldAs {
    readonly field: Field | Function;
    readonly alias: string;
    constructor(field: Field | Function, alias: string);
    set(field: Field | Function, alias: string): FieldAs;
    equal(field: FieldAs): boolean;
    toString(): string;
}
export declare type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'beginsWith' | 'in';
export declare abstract class Comparison {
    readonly field: Field | Function;
    readonly operator: ComparisonOperator;
    readonly args: List<Value>;
    constructor(field: Field | Function, operator: ComparisonOperator, args?: List<Value>);
    rename(name: Field | Function): Comparison;
    rename(name: string, alias?: string): Comparison;
    replaceArgument(replacer: (arg: Value) => undefined | Value): any;
    equal(comparison: Comparison): boolean;
    toString(): string;
}
export declare class ComparisonEqual extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonNotEqual extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonGreaterThan extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonGreaterThanOrEqual extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonLesserThan extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonLesserThanOrEqual extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonBeginsWith extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare class ComparisonIn extends Comparison {
    constructor(field: Field | Function, args: List<Value>);
}
export declare type BinaryOperator = 'and' | 'or' | 'xor';
export declare type BinaryExpression = Binary | Comparison;
export declare class Binary {
    readonly operator: BinaryOperator;
    readonly operands: List<BinaryExpression>;
    constructor(operator: BinaryOperator, operands?: List<BinaryExpression>);
    isLeaf(): boolean;
    add(expr: BinaryExpression): Binary;
    remove(expr: BinaryExpression): Binary;
    replace(search: BinaryExpression, replace: BinaryExpression, deep?: boolean): Binary;
    visit(visiter: (op: BinaryExpression) => undefined | BinaryExpression, deep?: boolean): Binary;
    equal(binary: Binary): boolean;
    toString(): string;
}
export declare class Query {
}
export declare type Join = {
    alias: string;
    on: BinaryExpression;
    query: QuerySelect;
};
export declare class QuerySelect extends Query {
    readonly fields?: List<Field | FieldAs> | undefined;
    readonly collection?: Collection | undefined;
    readonly joins?: List<Join> | undefined;
    readonly conditions?: Binary | undefined;
    readonly sorts?: List<FieldDirection> | undefined;
    readonly limit?: number | undefined;
    readonly offset: number;
    private type;
    constructor(fields?: List<Field | FieldAs> | undefined, collection?: Collection | undefined, joins?: List<Join> | undefined, conditions?: Binary | undefined, sorts?: List<FieldDirection> | undefined, limit?: number | undefined, offset?: number);
    select(...fields: (string | Field | FieldAs)[]): QuerySelect;
    from(name: string | Collection): QuerySelect;
    join(alias: string, query: QuerySelect, on: BinaryExpression): QuerySelect;
    where(condition: BinaryExpression): QuerySelect;
    sort(...fields: FieldDirection[]): QuerySelect;
    range({ limit, offset }: {
        limit?: number;
        offset?: number;
    }): QuerySelect;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryAggregate extends Query {
    readonly fields?: List<Field | FieldAs> | undefined;
    readonly collection?: Collection | undefined;
    readonly joins?: List<Join> | undefined;
    readonly conditions?: Binary | undefined;
    readonly groups?: List<Field | Function> | undefined;
    readonly sorts?: List<FieldDirection> | undefined;
    readonly limit?: number | undefined;
    readonly offset: number;
    private type;
    constructor(fields?: List<Field | FieldAs> | undefined, collection?: Collection | undefined, joins?: List<Join> | undefined, conditions?: Binary | undefined, groups?: List<Field | Function> | undefined, sorts?: List<FieldDirection> | undefined, limit?: number | undefined, offset?: number);
    select(...fields: (Field | FieldAs)[]): QueryAggregate;
    from(name: string | Collection): QueryAggregate;
    join(alias: string, query: QuerySelect, on: BinaryExpression): QueryAggregate;
    where(condition: BinaryExpression): QueryAggregate;
    group(...groups: (Field | Function)[]): QueryAggregate;
    sort(...fields: FieldDirection[]): QueryAggregate;
    range({ limit, offset }: {
        limit?: number;
        offset?: number;
    }): QueryAggregate;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryUnion extends Query {
    readonly selects?: List<QuerySelect> | undefined;
    readonly sorts?: List<FieldDirection> | undefined;
    readonly limit?: number | undefined;
    readonly offset: number;
    private type;
    constructor(selects?: List<QuerySelect> | undefined, sorts?: List<FieldDirection> | undefined, limit?: number | undefined, offset?: number);
    add(select: QuerySelect): QueryUnion;
    sort(...fields: FieldDirection[]): QueryUnion;
    range({ limit, offset }: {
        limit?: number;
        offset?: number;
    }): QueryUnion;
    toString(multiline?: boolean, indent?: string): string;
}
export declare type Object = Map<string, Value>;
export declare class QueryInsert extends Query {
    readonly objects?: List<Map<string, Value>> | undefined;
    readonly collection?: Collection | undefined;
    private type;
    constructor(objects?: List<Map<string, Value>> | undefined, collection?: Collection | undefined);
    add(object: Object | {
        [field: string]: Value;
    }): QueryInsert;
    into(name: string | Collection): QueryInsert;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryUpdate extends Query {
    readonly object?: Map<string, Value> | undefined;
    readonly collection?: Collection | undefined;
    readonly conditions?: Binary | undefined;
    private type;
    constructor(object?: Map<string, Value> | undefined, collection?: Collection | undefined, conditions?: Binary | undefined);
    from(name: string | Collection): QueryUpdate;
    set(object: Object | {
        [field: string]: Value;
    }): QueryUpdate;
    where(condition: BinaryExpression): QueryUpdate;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryDelete extends Query {
    readonly collection?: Collection | undefined;
    readonly conditions?: Binary | undefined;
    private type;
    constructor(collection?: Collection | undefined, conditions?: Binary | undefined);
    from(name: string | Collection): QueryDelete;
    where(condition: BinaryExpression): QueryDelete;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryShowCollection extends Query {
    private type;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryCollectionExists extends Query {
    readonly collection: Collection;
    private type;
    constructor(collection: Collection);
    rename(name: string | Collection): QueryCollectionExists;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryDescribeCollection extends Query {
    readonly collection: Collection;
    private type;
    constructor(collection: Collection);
    rename(name: string | Collection): QueryDescribeCollection;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryCreateCollection extends Query {
    readonly collection: Collection;
    readonly columns?: List<Column> | undefined;
    readonly indexes?: List<Index> | undefined;
    private type;
    constructor(collection: Collection, columns?: List<Column> | undefined, indexes?: List<Index> | undefined);
    rename(name: string | Collection): QueryCreateCollection;
    define(columns: Column[], indexes: Index[]): QueryCreateCollection;
    toString(multiline?: boolean, indent?: string): string;
}
export declare type ChangeAddColumn = {
    type: 'addColumn';
    column: Column;
    copyColumn?: string;
};
export declare type ChangeAlterColumn = {
    type: 'alterColumn';
    oldColumn: string;
    newColumn: Column;
};
export declare type ChangeDropColumn = {
    type: 'dropColumn';
    column: string;
};
export declare type ChangeAddIndex = {
    type: 'addIndex';
    index: Index;
};
export declare type ChangeDropIndex = {
    type: 'dropIndex';
    index: string;
};
export declare type Change = ChangeAddColumn | ChangeAlterColumn | ChangeDropColumn | ChangeAddIndex | ChangeDropIndex;
export declare class QueryAlterCollection extends Query {
    readonly collection: Collection;
    readonly renamed?: Collection | undefined;
    readonly changes?: List<Change> | undefined;
    private type;
    constructor(collection: Collection, renamed?: Collection | undefined, changes?: List<Change> | undefined);
    rename(name: string | Collection): QueryAlterCollection;
    addColumn(column: Column, copyColumn?: string): QueryAlterCollection;
    alterColumn(oldColumn: string, newColumn: Column): QueryAlterCollection;
    dropColumn(column: string): QueryAlterCollection;
    addIndex(index: Index): QueryAlterCollection;
    dropIndex(index: string): QueryAlterCollection;
    toString(multiline?: boolean, indent?: string): string;
}
export declare class QueryDropCollection extends Query {
    readonly collection: Collection;
    private type;
    constructor(collection: Collection);
    rename(name: string | Collection): QueryDropCollection;
    toString(multiline?: boolean, indent?: string): string;
}
