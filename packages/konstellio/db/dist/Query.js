"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const immutable_1 = require("immutable");
const util_1 = require("util");
class q {
    static select(...fields) {
        return new QuerySelect().select(...fields);
    }
    static aggregate(...fields) {
        return new QueryAggregate(immutable_1.List(fields));
    }
    static union(...selects) {
        return new QueryUnion(immutable_1.List(selects));
    }
    static insert(name) {
        return new QueryInsert().into(name);
    }
    static update(name) {
        return new QueryUpdate().from(name);
    }
    static delete(name) {
        return new QueryDelete().from(name);
    }
    static showCollection() {
        return new QueryShowCollection();
    }
    static createCollection(name) {
        return new QueryCreateCollection(typeof name === 'string' ? new Collection(name) : name);
    }
    static describeCollection(name) {
        return new QueryDescribeCollection(typeof name === 'string' ? new Collection(name) : name);
    }
    static alterCollection(name) {
        return new QueryAlterCollection(typeof name === 'string' ? new Collection(name) : name);
    }
    static collectionExists(name) {
        return new QueryCollectionExists(typeof name === 'string' ? new Collection(name) : name);
    }
    static dropCollection(name) {
        return new QueryDropCollection(typeof name === 'string' ? new Collection(name) : name);
    }
    static collection(name, namespace) {
        return new Collection(name, namespace);
    }
    static column(name, type, size, defaultValue, autoIncrement) {
        return new Column(name, type, size, defaultValue, autoIncrement);
    }
    static index(name, type, columns) {
        return new Index(name, type, immutable_1.List(columns || []));
    }
    static var(name) {
        return new Variable(name);
    }
    static field(name, alias) {
        return new Field(name, alias);
    }
    static sort(field, direction = 'asc') {
        return new FieldDirection(typeof field === 'string' ? new Field(field) : field, direction);
    }
    static as(field, alias) {
        return new FieldAs(typeof field === 'string' ? new Field(field) : field, alias);
    }
    static count(field) {
        return new FunctionCount(immutable_1.List([typeof field === 'string' ? new Field(field) : field]));
    }
    static avg(...args) {
        return new FunctionAvg(immutable_1.List(args));
    }
    static sum(...args) {
        return new FunctionSum(immutable_1.List(args));
    }
    static sub(...args) {
        return new FunctionSub(immutable_1.List(args));
    }
    static max(...args) {
        return new FunctionMax(immutable_1.List(args));
    }
    static min(...args) {
        return new FunctionMin(immutable_1.List(args));
    }
    static concat(...args) {
        return new FunctionConcat(immutable_1.List(args));
    }
    static eq(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonEqual(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static ne(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonNotEqual(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static gt(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonGreaterThan(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static gte(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonGreaterThanOrEqual(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static lt(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonLesserThan(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static lte(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonLesserThanOrEqual(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static in(field, values) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(util_1.isArray(values) && values.length > 0);
        return new ComparisonIn(typeof field === 'string' ? new Field(field) : field, immutable_1.List(values));
    }
    static beginsWith(field, value) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(value !== undefined);
        return new ComparisonBeginsWith(typeof field === 'string' ? new Field(field) : field, immutable_1.List([value]));
    }
    static and(...operands) {
        assert(operands.length > 0 && operands.filter(op => (op instanceof Binary || op instanceof Comparison) === false).length === 0);
        return new Binary("and", immutable_1.List(operands));
    }
    static or(...operands) {
        assert(operands.length > 0 && operands.filter(op => (op instanceof Binary || op instanceof Comparison) === false).length === 0);
        return new Binary("or", immutable_1.List(operands));
    }
    static xor(...operands) {
        assert(operands.length > 0 && operands.filter(op => (op instanceof Binary || op instanceof Comparison) === false).length === 0);
        return new Binary("xor", immutable_1.List(operands));
    }
}
exports.q = q;
class Collection {
    constructor(name, namespace) {
        this.name = name;
        this.namespace = namespace;
        assert(typeof name === 'string');
        assert(namespace === undefined || typeof namespace === 'string');
    }
    rename(name, namespace) {
        assert(typeof name === 'string');
        assert(namespace === undefined || typeof namespace === 'string');
        if (name !== this.name || namespace !== this.namespace) {
            return new Collection(name, namespace);
        }
        return this;
    }
    equal(collection) {
        return this.name === collection.name && this.namespace === collection.namespace;
    }
    toString() {
        return `${this.namespace ? this.namespace + '__' : ''}${this.name}`;
    }
}
exports.Collection = Collection;
var ColumnType;
(function (ColumnType) {
    ColumnType["Boolean"] = "boolean";
    ColumnType["Bit"] = "bit";
    ColumnType["UInt"] = "uint";
    ColumnType["Int"] = "int";
    ColumnType["Float"] = "float";
    ColumnType["Text"] = "text";
    ColumnType["Blob"] = "blob";
    ColumnType["Date"] = "date";
    ColumnType["DateTime"] = "datetime";
})(ColumnType = exports.ColumnType || (exports.ColumnType = {}));
class Column {
    constructor(name, type, size, defaultValue, autoIncrement = false) {
        this.name = name;
        this.type = type;
        this.size = size;
        this.defaultValue = defaultValue;
        this.autoIncrement = autoIncrement;
        assert(typeof name === 'string');
        assert(typeof type === 'string');
        assert(size === undefined || typeof size === 'number');
        assert(autoIncrement === undefined || typeof autoIncrement === 'boolean');
    }
    rename(name) {
        assert(typeof name === 'string');
        if (name !== this.name) {
            return new Column(name, this.type, this.size, this.defaultValue, this.autoIncrement);
        }
        return this;
    }
    resize(size) {
        assert(typeof size === 'number' && size > 0);
        if (size !== this.size) {
            return new Column(this.name, this.type, size, this.defaultValue, this.autoIncrement);
        }
        return this;
    }
    equal(column) {
        return this.name === column.name && this.type === column.type && this.size === column.size && this.defaultValue === column.defaultValue && this.autoIncrement === column.autoIncrement;
    }
    toString() {
        return `${this.name} ${this.type.toString().toUpperCase()}${this.size ? `(${this.size})` : ''}${this.defaultValue ? ` DEFAULT(${this.defaultValue})` : ''}${this.autoIncrement === true ? ' AUTOINCREMENT' : ''}`;
    }
}
exports.Column = Column;
var IndexType;
(function (IndexType) {
    IndexType["Primary"] = "primary";
    IndexType["Unique"] = "unique";
    IndexType["Index"] = "index";
})(IndexType = exports.IndexType || (exports.IndexType = {}));
class Index {
    constructor(name, type, columns = immutable_1.List()) {
        this.name = name;
        this.type = type;
        this.columns = columns;
        assert(typeof name === 'string');
        assert(typeof type === 'string');
        assert(columns instanceof immutable_1.List);
    }
    add(...columns) {
        assert(columns.length > 0);
        assert(columns.filter(column => (column instanceof FieldDirection) === false).length === 0);
        return new Index(this.name, this.type, this.columns.push(...columns));
    }
    equal(index) {
        return this.name === index.name && this.type === index.type && this.columns === index.columns;
    }
    toString() {
        return `${this.type.toString().toLocaleUpperCase()} ${this.name} (${this.columns.map(c => c ? c.toString() : '').join(', ')})`;
    }
}
exports.Index = Index;
class Variable {
    constructor(name) {
        this.name = name;
        assert(typeof name === 'string');
    }
    equal(variable) {
        return this.name === variable.name;
    }
    toString() {
        return `VAR(${this.name})`;
    }
}
exports.Variable = Variable;
class Field {
    constructor(name, alias) {
        this.name = name;
        this.alias = alias;
        assert(typeof name === 'string');
        assert(alias === undefined || typeof alias === 'string');
    }
    rename(name, alias) {
        assert(typeof name === 'string');
        assert(alias === undefined || typeof alias === 'string');
        if (name !== this.name || alias !== this.alias) {
            return new Field(name, alias || this.alias);
        }
        return this;
    }
    equal(field) {
        return this.name === field.name && this.alias === field.alias;
    }
    toString() {
        return `${this.alias ? this.alias + '.' : ''}${this.name}`;
    }
}
exports.Field = Field;
class FieldDirection {
    constructor(field, direction = 'asc') {
        this.field = field;
        this.direction = direction;
        assert(field instanceof Field);
        assert(direction === 'asc' || direction === 'desc');
    }
    sort(direction) {
        assert(direction === 'asc' || direction === 'desc');
        if (direction !== this.direction) {
            return new FieldDirection(this.field, direction);
        }
        return this;
    }
    rename(name, alias) {
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
    equal(field) {
        return this.field === field.field && this.direction === field.direction;
    }
    toString() {
        return `${this.field.toString()} ${this.direction.toUpperCase()}`;
    }
}
exports.FieldDirection = FieldDirection;
class Function {
    constructor(fn, args = immutable_1.List()) {
        this.fn = fn;
        this.args = args;
        assert(typeof fn === 'string');
        assert(args instanceof immutable_1.List);
    }
    replaceArgument(replacer) {
        assert(typeof replacer === 'function');
        let args = immutable_1.List();
        let changed = false;
        this.args.forEach(arg => {
            const replaced = replacer(arg);
            if (replaced) {
                changed = changed || arg !== replaced;
                args = args.push(replaced);
            }
            else {
                changed = true;
            }
        });
        if (changed) {
            const constructor = this.constructor;
            return new constructor(args);
        }
        return this;
    }
    equal(fn) {
        return this.fn === fn.fn && this.args === fn.args;
    }
    toString() {
        return `${this.fn.toUpperCase()}(${this.args.map(arg => arg && arg.toString()).join(', ')})`;
    }
}
exports.Function = Function;
class FunctionCount extends Function {
    constructor(args) {
        super('count', args);
    }
}
exports.FunctionCount = FunctionCount;
class FunctionAvg extends Function {
    constructor(args) {
        super('avg', args);
    }
}
exports.FunctionAvg = FunctionAvg;
class FunctionSum extends Function {
    constructor(args) {
        super('sum', args);
    }
}
exports.FunctionSum = FunctionSum;
class FunctionSub extends Function {
    constructor(args) {
        super('sub', args);
    }
}
exports.FunctionSub = FunctionSub;
class FunctionMax extends Function {
    constructor(args) {
        super('max', args);
    }
}
exports.FunctionMax = FunctionMax;
class FunctionMin extends Function {
    constructor(args) {
        super('min', args);
    }
}
exports.FunctionMin = FunctionMin;
class FunctionConcat extends Function {
    constructor(args) {
        super('concat', args);
    }
}
exports.FunctionConcat = FunctionConcat;
class FieldAs {
    constructor(field, alias) {
        this.field = field;
        this.alias = alias;
        assert(field instanceof Field || field instanceof Function);
        assert(typeof alias === 'string');
    }
    set(field, alias) {
        assert(typeof field === 'string' || field instanceof Field || field instanceof Function);
        assert(typeof alias === 'string');
        if (this.field !== field || this.alias !== alias) {
            return new FieldAs(field, alias);
        }
        return this;
    }
    equal(field) {
        return this.field === field.field && this.alias === field.alias;
    }
    toString() {
        return `${this.field.toString()} AS ${this.alias}`;
    }
}
exports.FieldAs = FieldAs;
class Comparison {
    constructor(field, operator, args = immutable_1.List()) {
        this.field = field;
        this.operator = operator;
        this.args = args;
        assert(field instanceof Field || field instanceof Function);
        assert(operator === '=' || operator === '!=' || operator === '>' || operator === '>=' || operator === '<' || operator === '<=' || operator === 'beginsWith' || operator === 'in');
        assert(args instanceof immutable_1.List);
    }
    rename(name, alias) {
        assert(typeof name === 'string' || name instanceof Field);
        assert(alias === undefined || typeof alias === 'string');
        const constructor = this.constructor;
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
                };
                const renamed = this.field.replaceArgument(renameArg);
                if (renamed !== this.field) {
                    return new constructor(renamed, this.args);
                }
            }
        }
        return this;
    }
    replaceArgument(replacer) {
        assert(typeof replacer === 'function');
        let args = immutable_1.List();
        let changed = false;
        this.args.forEach(arg => {
            const replaced = replacer(arg);
            if (replaced) {
                changed = changed || arg !== replaced;
                args = args.push(replaced);
            }
            else {
                changed = true;
            }
        });
        if (changed) {
            const constructor = this.constructor;
            return new constructor(this.field, args);
        }
        return this;
    }
    equal(comparison) {
        return this.field === comparison.field && this.operator === comparison.operator && this.args === comparison.args;
    }
    toString() {
        return `${this.field.toString()} ${this.operator} ${this.args.map(arg => arg ? arg.toString() : 'NULL').join(', ')}`;
    }
}
exports.Comparison = Comparison;
class ComparisonEqual extends Comparison {
    constructor(field, args) {
        super(field, '=', args);
    }
}
exports.ComparisonEqual = ComparisonEqual;
class ComparisonNotEqual extends Comparison {
    constructor(field, args) {
        super(field, '!=', args);
    }
}
exports.ComparisonNotEqual = ComparisonNotEqual;
class ComparisonGreaterThan extends Comparison {
    constructor(field, args) {
        super(field, '>', args);
    }
}
exports.ComparisonGreaterThan = ComparisonGreaterThan;
class ComparisonGreaterThanOrEqual extends Comparison {
    constructor(field, args) {
        super(field, '>=', args);
    }
}
exports.ComparisonGreaterThanOrEqual = ComparisonGreaterThanOrEqual;
class ComparisonLesserThan extends Comparison {
    constructor(field, args) {
        super(field, '<', args);
    }
}
exports.ComparisonLesserThan = ComparisonLesserThan;
class ComparisonLesserThanOrEqual extends Comparison {
    constructor(field, args) {
        super(field, '<=', args);
    }
}
exports.ComparisonLesserThanOrEqual = ComparisonLesserThanOrEqual;
class ComparisonBeginsWith extends Comparison {
    constructor(field, args) {
        super(field, 'beginsWith', args);
    }
}
exports.ComparisonBeginsWith = ComparisonBeginsWith;
class ComparisonIn extends Comparison {
    constructor(field, args) {
        super(field, 'in', args);
    }
}
exports.ComparisonIn = ComparisonIn;
class Binary {
    constructor(operator, operands = immutable_1.List()) {
        this.operator = operator;
        this.operands = operands;
        assert(operator === 'and' || operator === 'or' || operator === 'xor');
        assert(operands instanceof immutable_1.List);
    }
    isLeaf() {
        return this.operands.filter(op => op instanceof Binary).count() === 0;
    }
    add(expr) {
        assert(expr instanceof Binary || expr instanceof Comparison);
        return new Binary(this.operator, this.operands.push(expr));
    }
    remove(expr) {
        assert(expr instanceof Binary || expr instanceof Comparison);
        if (this.operands.contains(expr)) {
            return new Binary(this.operator, this.operands.filter(op => op !== expr).toList());
        }
        return this;
    }
    replace(search, replace, deep = false) {
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
    visit(visiter, deep = false) {
        assert(typeof visiter === 'function');
        assert(typeof deep === 'boolean');
        let operands = immutable_1.List();
        let changed = false;
        this.operands.forEach(arg => {
            const replaced = visiter(arg);
            if (replaced) {
                changed = changed || arg !== replaced;
                operands = operands.push(replaced);
            }
            else if (deep === true && arg instanceof Binary) {
                const replaced = arg.visit(visiter, true);
                if (replaced) {
                    changed = changed || arg !== replaced;
                    operands = operands.push(replaced);
                }
                else {
                    changed = true;
                }
            }
            else {
                changed = true;
            }
        });
        if (changed) {
            return new Binary(this.operator, operands);
        }
        return this;
    }
    equal(binary) {
        return this.operator === binary.operator && this.operands === binary.operands;
    }
    toString() {
        return `(${this.operands.map(op => op.toString()).join(` ${this.operator.toUpperCase()} `)})`;
    }
}
exports.Binary = Binary;
class Query {
}
exports.Query = Query;
class QuerySelect extends Query {
    constructor(fields, collection, joins, conditions, sorts, limit, offset = 0) {
        super();
        this.fields = fields;
        this.collection = collection;
        this.joins = joins;
        this.conditions = conditions;
        this.sorts = sorts;
        this.limit = limit;
        this.offset = offset;
    }
    select(...fields) {
        return new QuerySelect(immutable_1.List(fields.map(field => typeof field === 'string' ? new Field(field) : field)), this.collection, this.joins, this.conditions, this.sorts, this.limit, this.offset);
    }
    from(name) {
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
    join(alias, query, on) {
        const join = { alias, query, on };
        return new QuerySelect(this.fields, this.collection, this.joins ? this.joins.push(join) : immutable_1.List(join), this.conditions, this.sorts, this.limit, this.offset);
    }
    where(condition) {
        return new QuerySelect(this.fields, this.collection, this.joins, condition instanceof Comparison ? new Binary('and', immutable_1.List([condition])) : condition, this.sorts, this.limit, this.offset);
    }
    sort(...fields) {
        return new QuerySelect(this.fields, this.collection, this.joins, this.conditions, immutable_1.List(fields), this.limit, this.offset);
    }
    range({ limit, offset }) {
        if (limit !== this.limit || offset !== this.offset) {
            return new QuerySelect(this.fields, this.collection, this.joins, this.conditions, this.sorts, limit !== undefined ? limit : this.limit, offset !== undefined ? offset : this.offset);
        }
        return this;
    }
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        let query = `${indent}SELECT `;
        if (this.fields) {
            query += this.fields.map(field => field ? field.toString() : ``).join(', ');
        }
        else {
            query += `*`;
        }
        if (this.collection) {
            query += `${newline}${indent}FROM ${this.collection.toString()}`;
        }
        if (this.joins) {
            query += this.joins.map(join => {
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
            query += `${newline}${indent}SORT BY ${this.sorts.map(s => s ? s.toString() : '').join(', ')}`;
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
exports.QuerySelect = QuerySelect;
class QueryAggregate extends Query {
    constructor(fields, collection, joins, conditions, groups, sorts, limit, offset = 0) {
        super();
        this.fields = fields;
        this.collection = collection;
        this.joins = joins;
        this.conditions = conditions;
        this.groups = groups;
        this.sorts = sorts;
        this.limit = limit;
        this.offset = offset;
    }
    select(...fields) {
        return new QueryAggregate(immutable_1.List(fields), this.collection, this.joins, this.conditions, this.groups, this.sorts, this.limit, this.offset);
    }
    from(name) {
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
    join(alias, query, on) {
        const join = { alias, query, on };
        return new QueryAggregate(this.fields, this.collection, this.joins ? this.joins.push(join) : immutable_1.List([join]), this.conditions, this.groups, this.sorts, this.limit, this.offset);
    }
    where(condition) {
        return new QueryAggregate(this.fields, this.collection, this.joins, condition instanceof Comparison ? new Binary('and', immutable_1.List([condition])) : condition, this.groups, this.sorts, this.limit, this.offset);
    }
    group(...groups) {
        return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, immutable_1.List(groups), this.sorts, this.limit, this.offset);
    }
    sort(...fields) {
        return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, this.groups, immutable_1.List(fields), this.limit, this.offset);
    }
    range({ limit, offset }) {
        if (limit !== this.limit || offset !== this.offset) {
            return new QueryAggregate(this.fields, this.collection, this.joins, this.conditions, this.groups, this.sorts, limit !== undefined ? limit : this.limit, offset !== undefined ? offset : this.offset);
        }
        return this;
    }
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        let query = `${indent}SELECT `;
        if (this.fields) {
            query += this.fields.map(field => field ? field.toString() : ``).join(', ');
        }
        else {
            query += `*`;
        }
        if (this.collection) {
            query += `${newline}${indent}FROM ${this.collection.toString()}`;
        }
        if (this.joins) {
            query += this.joins.map(join => {
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
            query += `${newline}${indent}GROUP BY ${this.groups.map(s => s ? s.toString() : '').join(', ')}`;
        }
        if (this.sorts) {
            query += `${newline}${indent}SORT BY ${this.sorts.map(s => s ? s.toString() : '').join(', ')}`;
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
exports.QueryAggregate = QueryAggregate;
class QueryUnion extends Query {
    constructor(selects, sorts, limit, offset = 0) {
        super();
        this.selects = selects;
        this.sorts = sorts;
        this.limit = limit;
        this.offset = offset;
    }
    add(select) {
        return new QueryUnion(this.selects ? this.selects.push(select) : immutable_1.List([select]), this.sorts, this.limit, this.offset);
    }
    sort(...fields) {
        return new QueryUnion(this.selects, immutable_1.List(fields), this.limit, this.offset);
    }
    range({ limit, offset }) {
        if (limit !== this.limit || offset !== this.offset) {
            return new QueryUnion(this.selects, this.sorts, limit !== undefined ? limit : this.limit, offset !== undefined ? offset : this.offset);
        }
        return this;
    }
    toString(multiline = false, indent) {
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        if (this.selects) {
            let query = `(${newline}${this.selects.map(s => s ? s.toString(!!multiline, `${indent}\t`) : '').join(`${newline}) UNION (${newline}`)}${newline})`;
            if (this.sorts) {
                query += `${newline}${indent}SORT BY ${this.sorts.map(s => s ? s.toString() : '').join(', ')}`;
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
exports.QueryUnion = QueryUnion;
class QueryInsert extends Query {
    constructor(objects, collection) {
        super();
        this.objects = objects;
        this.collection = collection;
    }
    add(object) {
        const map = immutable_1.Map(object);
        return new QueryInsert(this.objects ? this.objects.push(map) : immutable_1.List([map]), this.collection);
    }
    into(name) {
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
    toString(multiline, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        let query = `${indent}INSERT `;
        if (this.collection) {
            query += this.collection.toString();
        }
        if (this.objects && this.objects.count() > 0) {
            const keys = Array.from(this.objects.get(0).keys());
            query += `${newline}${indent}(${keys.map(key => key || '').join(', ')})`;
            query += `${newline}${indent}VALUES ${this.objects.map(obj => {
                return `(${keys.map(key => {
                    const value = obj.get(key);
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
exports.QueryInsert = QueryInsert;
class QueryUpdate extends Query {
    constructor(object, collection, conditions) {
        super();
        this.object = object;
        this.collection = collection;
        this.conditions = conditions;
    }
    from(name) {
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
    set(object) {
        const map = immutable_1.Map(object);
        return new QueryUpdate(map, this.collection, this.conditions);
    }
    where(condition) {
        return new QueryUpdate(this.object, this.collection, condition instanceof Comparison ? new Binary('and', immutable_1.List([condition])) : condition);
    }
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        let query = `${indent}UPDATE `;
        if (this.collection) {
            query += this.collection.toString();
        }
        if (this.object) {
            const keys = Object.keys(this.object);
            query += `${newline}${indent}(${keys.map(key => key || '').join(', ')})`;
            query += `${newline}${indent}VALUES (${keys.map(key => {
                const value = this.object.get(key);
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
exports.QueryUpdate = QueryUpdate;
class QueryDelete extends Query {
    constructor(collection, conditions) {
        super();
        this.collection = collection;
        this.conditions = conditions;
    }
    from(name) {
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
    where(condition) {
        return new QueryDelete(this.collection, condition instanceof Comparison ? new Binary('and', immutable_1.List([condition])) : condition);
    }
    toString(multiline = false, indent) {
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
exports.QueryDelete = QueryDelete;
class QueryShowCollection extends Query {
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let query = `${indent}SHOW COLLECTIONS`;
        return query;
    }
}
exports.QueryShowCollection = QueryShowCollection;
class QueryCollectionExists extends Query {
    constructor(collection) {
        super();
        this.collection = collection;
    }
    rename(name) {
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
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let query = `${indent}COLLECTION EXISTS `;
        if (this.collection) {
            query += this.collection.toString();
        }
        return query;
    }
}
exports.QueryCollectionExists = QueryCollectionExists;
class QueryDescribeCollection extends Query {
    constructor(collection) {
        super();
        this.collection = collection;
    }
    rename(name) {
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
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let query = `${indent}DESCRIBE COLLECTION `;
        if (this.collection) {
            query += this.collection.toString();
        }
        return query;
    }
}
exports.QueryDescribeCollection = QueryDescribeCollection;
class QueryCreateCollection extends Query {
    constructor(collection, columns, indexes) {
        super();
        this.collection = collection;
        this.columns = columns;
        this.indexes = indexes;
    }
    rename(name) {
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
    define(columns, indexes) {
        return new QueryCreateCollection(this.collection, immutable_1.List(columns), immutable_1.List(indexes));
    }
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        let query = `${indent}CREATE COLLECTION `;
        if (this.collection) {
            query += this.collection.toString();
        }
        query += ` (`;
        if (this.columns) {
            query += `${newline}${indent}${this.columns.map(c => c ? c.toString() : '').join(`,${newline}${indent}`)}`;
        }
        query += `${newline}${indent})`;
        if (this.indexes) {
            query += ` ${newline}${indent}INDEXES (`;
            query += `${newline}${indent}${this.indexes.map(i => i ? i.toString() : '').join(`,${newline}${indent}`)}`;
            query += `${newline}${indent})`;
        }
        return query;
    }
}
exports.QueryCreateCollection = QueryCreateCollection;
class QueryAlterCollection extends Query {
    constructor(collection, renamed, changes) {
        super();
        this.collection = collection;
        this.renamed = renamed;
        this.changes = changes;
    }
    rename(name) {
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
    addColumn(column, copyColumn) {
        const changes = this.changes ? this.changes : immutable_1.List();
        return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'addColumn', column, copyColumn }));
    }
    alterColumn(oldColumn, newColumn) {
        const changes = this.changes ? this.changes : immutable_1.List();
        return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'alterColumn', oldColumn, newColumn }));
    }
    dropColumn(column) {
        const changes = this.changes ? this.changes : immutable_1.List();
        return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'dropColumn', column }));
    }
    addIndex(index) {
        const changes = this.changes ? this.changes : immutable_1.List();
        return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'addIndex', index }));
    }
    dropIndex(index) {
        const changes = this.changes ? this.changes : immutable_1.List();
        return new QueryAlterCollection(this.collection, this.renamed, changes.push({ type: 'dropIndex', index }));
    }
    toString(multiline, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let newline = multiline ? `\n` : ' ';
        let query = `${indent}ALTER COLLECTION `;
        if (this.collection) {
            query += this.collection.toString();
        }
        query += ` (`;
        if (this.changes) {
            query += `${newline}${indent}${this.changes.map(c => {
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
exports.QueryAlterCollection = QueryAlterCollection;
class QueryDropCollection extends Query {
    constructor(collection) {
        super();
        this.collection = collection;
    }
    rename(name) {
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
    toString(multiline = false, indent) {
        multiline = !!multiline;
        indent = multiline && indent ? indent : '';
        let query = `${indent}DROP COLLECTION `;
        if (this.collection) {
            query += this.collection.toString();
        }
        return query;
    }
}
exports.QueryDropCollection = QueryDropCollection;
//# sourceMappingURL=Query.js.map