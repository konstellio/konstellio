import 'mocha';
import { expect } from 'chai';
import * as Query from './Query';
import { Map, List } from 'immutable';

const { q, ColumnType, IndexType } = Query;

describe('Query', () => {

	it('collection', async () => {
		expect(q.collection).to.be.a('function');
		expect(q.collection('foo')).to.be.an.instanceof(Query.Collection);
		expect(q.collection('foo').name).to.equal('foo');
		expect(q.collection('foo').namespace).to.equal(undefined);
		expect(q.collection('foo', 'bar').namespace).to.equal('bar');
		expect(q.collection('foo').rename('moo').name).to.equal('moo');
		expect(q.collection('foo', 'bar').rename('moo', 'joo').name).to.equal('moo');
		expect(q.collection('foo', 'bar').rename('moo', 'joo').namespace).to.equal('joo');

		const a = q.collection('foo', 'bar');
		const b = a.rename('moo');
		expect(a).to.not.equal(b);
	});

	it('variable', async () => {
		expect(q.var).to.be.a('function');
		expect(q.var('foo')).to.be.an.instanceof(Query.Variable);
		expect(q.var('foo').name).to.equal('foo');
	});

	it('field', async () => {

		expect(q.field).to.be.a('function');
		expect(q.field('foo')).to.be.an.instanceof(Query.Field);
		expect(q.field('foo').name).to.equal('foo');
		expect(q.field('foo').alias).to.equal(undefined);
		expect(q.field('foo', 'bar').alias).to.equal('bar');
		expect(q.field('foo').rename('moo').name).to.equal('moo');
		expect(q.field('foo', 'bar').rename('moo', 'joo').alias).to.equal('joo');

		const a = q.field('foo');
		const b = a.rename('moo');
		expect(a).to.not.equal(b);

		expect(q.sort).to.be.a('function')
		expect(q.sort('foo', 'asc')).to.be.an.instanceof(Query.FieldDirection);
		expect(q.sort('foo', 'asc').field).to.be.an.instanceof(Query.Field);
		expect(q.sort('foo', 'asc').direction).to.equal('asc');
		expect(q.sort('foo', 'asc').rename('moo', 'joo')).to.be.an.instanceof(Query.FieldDirection);
		expect(q.sort('foo', 'asc').rename('moo', 'joo').field).to.be.an.instanceof(Query.Field);
		expect(q.sort('foo', 'asc').rename('moo', 'joo').field.name).to.equal('moo');
		expect(q.sort('foo', 'asc').rename('moo', 'joo').field.alias).to.equal('joo');
		expect(q.sort(q.field('foo', 'bar'), 'asc')).to.be.an.instanceof(Query.FieldDirection);
		expect(q.sort(q.field('foo', 'bar'), 'asc').field).to.be.an.instanceof(Query.Field);
		expect(q.sort(q.field('foo', 'bar'), 'asc').direction).to.equal('asc');
		expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo')).to.be.an.instanceof(Query.FieldDirection);
		expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo').field).to.be.an.instanceof(Query.Field);
		expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo').field.name).to.equal('moo');
		expect(q.sort(q.field('foo', 'bar'), 'asc').rename('moo', 'joo').field.alias).to.equal('joo');

		const c = q.sort('foo', 'asc');
		const d = c.rename('moo');
		expect(c).to.not.equal(d);
	});

	it('function', async () => {
		expect(q.count).to.be.a('function');
		expect(q.count('foo')).to.be.an.instanceof(Query.FunctionCount);
		expect(q.count('foo').fn).to.equal('count');
		expect(q.count('foo').args.count()).to.equal(1);
		expect(q.count('foo').args.get(0)).to.be.an.instanceof(Query.Field);

		['avg', 'sum', 'sub', 'max', 'min', 'concat'].forEach(fnName => {
			const fn = q[fnName];
			expect(fn).to.be.a('function');
			expect(fn('foo')).to.be.an.instanceof(Query.Function);
			expect(fn('foo').fn).to.equal(fnName);
			expect(fn('foo').args.count()).to.equal(1);
			expect(fn('foo').args.get(0)).to.equal('foo');
			expect(fn('foo', q.field('bar')).args.count()).to.equal(2);
			expect(fn('foo', q.field('bar')).args.get(1)).to.be.an.instanceof(Query.Field);
		});
	});

	it('comparison', async () => {
		[['eq', '='], ['ne', '!='], ['gt', '>'], ['gte', '>='], ['lt', '<'], ['lte', '<='], ['beginsWith', 'beginsWith']].forEach(([fnName, operator]) => {
			const fn = q[fnName];
			expect(fn).to.be.a('function');
			expect(fn(q.field('foo'), 'bar')).to.be.an.instanceof(Query.Comparison);
			expect(fn(q.field('foo'), 'bar').field).to.be.an.instanceof(Query.Field);
			expect(fn(q.field('foo'), 'bar').field.name).to.equal('foo');
			expect(fn(q.field('foo'), 'bar').operator).to.equal(operator);
			expect(fn(q.field('foo'), 'bar').args.count()).to.equal(1);
			expect(fn(q.field('foo'), 'bar').args.get(0)).to.equal('bar');
		});

		expect(q.in).to.be.a('function');
		expect(q.in(q.field('foo'), ['bar'])).to.be.an.instanceof(Query.Comparison);
		expect(q.in(q.field('foo'), ['bar']).field).to.be.an.instanceof(Query.Field);
		expect(q.in(q.field('foo'), ['bar']).operator).to.equal('in');
		expect(q.in(q.field('foo'), ['bar']).args.count()).to.equal(1);
		expect(q.in(q.field('foo'), ['bar']).args.get(0)).to.equal('bar');

		const a = q.eq('foo', 'bar');
		const b = a.replaceArgument(arg => 'moo');
		expect(a).to.not.equal(b);
		expect(b).to.be.an.instanceof(Query.ComparisonEqual);
		expect(b.args.get(0)).to.equal('moo');
	});

	it('binary', async () => {
		['and', 'or', 'xor'].forEach(op => {
			const fn = q[op];
			expect(fn).to.be.a('function');
			expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo'))).to.be.an.instanceof(Query.Binary);
			expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operator).to.equal(op);
			expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operands.count()).to.equal(2);
			expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operands.get(0)).to.be.an.instanceof(Query.ComparisonEqual);
			expect(fn(q.eq('foo', 'bar'), q.gt('moo', 'joo')).operands.get(1)).to.be.an.instanceof(Query.ComparisonGreaterThan);
		});

		const op1 = q.lt('boo', 'hoo');
		const op2 = q.ne('coo', 'koo');
		const a = q.and(q.eq('foo', 'bar'), q.gt('moo', 'joo'));
		const b = a.add(op1);
		const c = b.replace(op1, op2);
		const d = b.replace(q.eq('foo', 'bar'), op2);
		expect(a).to.not.equal(b);
		expect(b.operands.count()).to.equal(3);
		expect(b.operands.get(2)).to.equal(op1);
		expect(b).to.not.equal(c);
		expect(c.operands.get(2)).to.equal(op2);
		expect(b).to.equal(d);
	});

	it('column', async () => {
		expect(q.column).to.be.a('function');
		expect(q.column('foo', ColumnType.Int, 8, 0, false)).to.be.an.instanceof(Query.Column);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).name).to.equal('foo');
		expect(q.column('foo', ColumnType.Int, 8, 0, false).type).to.equal(ColumnType.Int);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).size).to.equal(8);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).defaultValue).to.equal(0);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).autoIncrement).to.equal(false);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').name).to.equal('bar');
		expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').type).to.equal(ColumnType.Int);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').size).to.equal(8);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').defaultValue).to.equal(0);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).rename('bar').autoIncrement).to.equal(false);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).name).to.equal('foo');
		expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).type).to.equal(ColumnType.Int);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).size).to.equal(16);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).defaultValue).to.equal(0);
		expect(q.column('foo', ColumnType.Int, 8, 0, false).resize(16).autoIncrement).to.equal(false);

		const a = q.column('foo', ColumnType.Int, 8, 0, false);
		const b = a.rename('bar');
		const c = a.resize(16);
		const d = a.resize(8);
		expect(a).to.not.equal(b);
		expect(a).to.not.equal(c);
		expect(a).to.equal(d);
	});

	it('index', async () => {
		expect(q.index).to.be.a('function');
		expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')])).to.be.an.instanceof(Query.Index);
		expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).name).to.equal('foo');
		expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).type).to.equal(IndexType.Primary);
		expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).columns.count()).to.equal(1);
		expect(q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]).columns.get(0)).to.be.an.instanceof(Query.FieldDirection);

		const a = q.index('foo', IndexType.Primary, [q.sort('foo', 'asc')]);
		const b = a.add(q.sort('moo', 'asc'));
		expect(a).to.not.equal(b);
		expect(b.columns.count()).to.equal(2);
	});

});