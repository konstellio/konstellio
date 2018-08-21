"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
const Query = require("./Query");
const { q, ColumnType, IndexType } = Query;
describe('Query', () => {
    it('collection', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(q.collection).to.be.a('function');
        chai_1.expect(q.collection('foo')).to.be.an.instanceof(Query.Collection);
        chai_1.expect(q.collection('foo').name).to.equal('foo');
        chai_1.expect(q.collection('foo').namespace).to.equal(undefined);
        chai_1.expect(q.collection('foo', 'bar').namespace).to.equal('bar');
        chai_1.expect(q.collection('foo').rename('moo').name).to.equal('moo');
        chai_1.expect(q.collection('foo', 'bar').rename('moo', 'joo').name).to.equal('moo');
        chai_1.expect(q.collection('foo', 'bar').rename('moo', 'joo').namespace).to.equal('joo');
        const a = q.collection('foo', 'bar');
        const b = a.rename('moo');
        chai_1.expect(a).to.not.equal(b);
    }));
    it('variable', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(q.var).to.be.a('function');
        chai_1.expect(q.var('foo')).to.be.an.instanceof(Query.Variable);
        chai_1.expect(q.var('foo').name).to.equal('foo');
    }));
    it('field', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(q.field).to.be.a('function');
        chai_1.expect(q.field('foo')).to.be.an.instanceof(Query.Field);
        chai_1.expect(q.field('foo').name).to.equal('foo');
        chai_1.expect(q.field('foo').alias).to.equal(undefined);
        chai_1.expect(q.field('foo', 'bar').alias).to.equal('bar');
        chai_1.expect(q.field('foo').rename('moo').name).to.equal('moo');
        chai_1.expect(q.field('foo', 'bar').rename('moo', 'joo').alias).to.equal('joo');
        const a = q.field('foo');
        const b = a.rename('moo');
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(q.sort).to.be.a('function');
        chai_1.expect(q.sort('foo', 'asc')).to.be.an.instanceof(Query.FieldDirection);
        chai_1.expect(q.sort('foo', 'asc').field).to.be.an.instanceof(Query.Field);
        chai_1.expect(q.sort('foo', 'asc').direction).to.equal('asc');
        chai_1.expect(q.sort('foo', 'asc').rename('moo', 'joo')).to.be.an.instanceof(Query.FieldDirection);
        chai_1.expect(q.sort('foo', 'asc').rename('moo', 'joo').field).to.be.an.instanceof(Query.Field);
        chai_1.expect(q.sort('foo', 'asc').rename('moo', 'joo').field.name).to.equal('moo');
        chai_1.expect(q.sort('foo', 'asc').rename('moo', 'joo').field.alias).to.equal('joo');
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc')).to.be.an.instanceof(Query.FieldDirection);
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc').field).to.be.an.instanceof(Query.Field);
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc').direction).to.equal('asc');
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo')).to.be.an.instanceof(Query.FieldDirection);
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo').field).to.be.an.instanceof(Query.Field);
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo').field.name).to.equal('moo');
        chai_1.expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo').field.alias).to.equal('joo');
        const c = q.sort('foo', 'asc');
        const d = c.rename('moo');
        chai_1.expect(c).to.not.equal(d);
    }));
    it('function', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(q.count).to.be.a('function');
        chai_1.expect(q.count('foo')).to.be.an.instanceof(Query.FunctionCount);
        chai_1.expect(q.count('foo').fn).to.equal('count');
        chai_1.expect(q.count('foo').args.count()).to.equal(1);
        chai_1.expect(q.count('foo').args.get(0)).to.be.an.instanceof(Query.Field);
        ['avg', 'sum', 'sub', 'max', 'min', 'concat'].forEach(fnName => {
            const fn = q[fnName];
            chai_1.expect(fn).to.be.a('function');
            chai_1.expect(fn('foo')).to.be.an.instanceof(Query.Function);
            chai_1.expect(fn('foo').fn).to.equal(fnName);
            chai_1.expect(fn('foo').args.count()).to.equal(1);
            chai_1.expect(fn('foo').args.get(0)).to.equal('foo');
            chai_1.expect(fn('foo', q.field('bar')).args.count()).to.equal(2);
            chai_1.expect(fn('foo', q.field('bar')).args.get(1)).to.be.an.instanceof(Query.Field);
        });
    }));
    it('comparison', () => __awaiter(this, void 0, void 0, function* () {
        [['eq', '='], ['ne', '!='], ['gt', '>'], ['gte', '>='], ['lt', '<'], ['lte', '<='], ['beginsWith', 'beginsWith']].forEach(([fnName, operator]) => {
            const fn = q[fnName];
            chai_1.expect(fn).to.be.a('function');
            chai_1.expect(fn(q.field('foo'), 'bar')).to.be.an.instanceof(Query.Comparison);
            chai_1.expect(fn(q.field('foo'), 'bar').field).to.be.an.instanceof(Query.Field);
            chai_1.expect(fn(q.field('foo'), 'bar').field.name).to.equal('foo');
            chai_1.expect(fn(q.field('foo'), 'bar').operator).to.equal(operator);
            chai_1.expect(fn(q.field('foo'), 'bar').args.count()).to.equal(1);
            chai_1.expect(fn(q.field('foo'), 'bar').args.get(0)).to.equal('bar');
        });
        chai_1.expect(q.in).to.be.a('function');
        chai_1.expect(q.in(q.field('foo'), ['bar'])).to.be.an.instanceof(Query.Comparison);
        chai_1.expect(q.in(q.field('foo'), ['bar']).field).to.be.an.instanceof(Query.Field);
        chai_1.expect(q.in(q.field('foo'), ['bar']).operator).to.equal('in');
        chai_1.expect(q.in(q.field('foo'), ['bar']).args.count()).to.equal(1);
        chai_1.expect(q.in(q.field('foo'), ['bar']).args.get(0)).to.equal('bar');
        const a = q.eq('foo', 'bar');
        const b = a.replaceArgument(() => 'moo');
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(b).to.be.an.instanceof(Query.ComparisonEqual);
        chai_1.expect(b.args.get(0)).to.equal('moo');
    }));
    it('binary', () => __awaiter(this, void 0, void 0, function* () {
        ['and', 'or', 'xor'].forEach(op => {
            const fn = q[op];
            chai_1.expect(fn).to.be.a('function');
            chai_1.expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo'))).to.be.an.instanceof(Query.Binary);
            chai_1.expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operator).to.equal(op);
            chai_1.expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operands.count()).to.equal(2);
            chai_1.expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operands.get(0)).to.be.an.instanceof(Query.ComparisonEqual);
            chai_1.expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operands.get(1)).to.be.an.instanceof(Query.ComparisonGreaterThan);
        });
        const op1 = q.lt('boo', 'hoo');
        const op2 = q.ne('coo', 'koo');
        const a = q.and(q.eq('foo', 'bar'), q.gt('moo', 'joo'));
        const b = a.add(op1);
        const c = b.replace(op1, op2);
        const d = b.replace(q.eq('foo', 'bar'), op2);
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(b.operands.count()).to.equal(3);
        chai_1.expect(b.operands.get(2)).to.equal(op1);
        chai_1.expect(b).to.not.equal(c);
        chai_1.expect(c.operands.get(2)).to.equal(op2);
        chai_1.expect(b).to.equal(d);
    }));
    it('column', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(q.column).to.be.a('function');
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false)).to.be.an.instanceof(Query.Column);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).name).to.equal('foo');
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).type).to.equal(ColumnType.Int);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).size).to.equal(8);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).defaultValue).to.equal(0);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).autoIncrement).to.equal(false);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').name).to.equal('bar');
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').type).to.equal(ColumnType.Int);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').size).to.equal(8);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').defaultValue).to.equal(0);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').autoIncrement).to.equal(false);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).name).to.equal('foo');
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).type).to.equal(ColumnType.Int);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).size).to.equal(16);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).defaultValue).to.equal(0);
        chai_1.expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).autoIncrement).to.equal(false);
        const a = q.column('foo', ColumnType.Int, 8, 0, false);
        const b = a.rename('bar');
        const c = a.resize(16);
        const d = a.resize(8);
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(a).to.not.equal(c);
        chai_1.expect(a).to.equal(d);
    }));
    it('index', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(q.index).to.be.a('function');
        chai_1.expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')])).to.be.an.instanceof(Query.Index);
        chai_1.expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).name).to.equal('foo');
        chai_1.expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).type).to.equal(IndexType.Primary);
        chai_1.expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).columns.count()).to.equal(1);
        chai_1.expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).columns.get(0)).to.be.an.instanceof(Query.FieldDirection);
        const a = q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]);
        const b = a.add(q.sort('moo', 'asc'));
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(b.columns.count()).to.equal(2);
    }));
});
//# sourceMappingURL=Query.spec.js.map