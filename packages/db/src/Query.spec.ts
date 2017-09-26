import 'mocha';
import { expect } from 'chai';
import { q, ColumnType, SelectQuery, Expression } from './Query';
import { Map, List } from 'immutable';

describe('Query', () => {

	describe('types', () => {

		it('field', () => {
			const a = q.field('foo');
			const b = a.rename('bar');
			expect(a.name).to.equal('foo');
			expect(b.name).to.equal('bar');
			expect(a).to.not.equal(b);
		});

		it('sortable field', () => {
			const a = q.sort('foo', 'asc');
			const b = a.rename('bar');
			const c = b.sort('desc');
			expect(a.name).to.equal('foo');
			expect(a.direction).to.equal('asc');
			expect(b.name).to.equal('bar');
			expect(b.direction).to.equal('asc');
			expect(c.name).to.equal('bar');
			expect(c.direction).to.equal('desc');
			expect(a).to.not.equal(b);
			expect(a).to.not.equal(c);
			expect(b).to.not.equal(c);
		});

		it('calc field', () => {
			const a = q.count('foo');
			expect(() => { (<any>a).function = 'avg'; }).to.throw(Error);
		});

		it('collection', () => {
			const a = q.collection('foo', 'bar');
			expect(() => { (<any>a).name = 'moo'; }).to.throw(Error);
			expect(() => { (<any>a).namespace = 'joo'; }).to.throw(Error);
		});

		it('comparison', () => {
			const a = q.eq('foo', 'moo');
			const b = a.set('joo');
			expect(a.field).to.equal('foo');
			expect(a.operator).to.equal('=');
			expect(a.value).to.equal('moo');
			expect(b.field).to.equal('foo');
			expect(b.operator).to.equal('=');
			expect(b.value).to.equal('joo');
			expect(a).to.not.equal(b);
			expect(() => { (<any>a).field = 'bar'; }).to.throw(Error);
			expect(() => { (<any>a).operator = '!='; }).to.throw(Error);
			expect(() => { (<any>a).value = 'joo'; }).to.throw(Error);
		});

		it('binary', () => {
			const eq = q.eq('foo', 'moo');
			const ne = q.ne('bar', 'joo');
			const lt = q.lt('moo', 'joo');
			const a = q.and(eq, ne);
			const b = a.add(lt);
			expect(a.operator).to.equal('and');
			expect(b.operator).to.equal('and');
			expect(a.operands).to.not.equal(undefined);
			expect(b.operands).to.not.equal(undefined);
			expect((<List<Expression>>a.operands).count()).to.equal(2);
			expect((<List<Expression>>b.operands).count()).to.equal(3);
			expect((<List<Expression>>a.operands).get(0)).to.equal(eq);
			expect((<List<Expression>>a.operands).get(1)).to.equal(ne);
			expect((<List<Expression>>a.operands).get(0)).to.equal((<List<Expression>>b.operands).get(0));
			expect((<List<Expression>>a.operands).get(1)).to.equal((<List<Expression>>b.operands).get(1));
			expect((<List<Expression>>b.operands).get(2)).to.equal(lt);

			const c = a.replace(eq, lt);
			const d = a.replace(lt, eq);
			const e = c.replace(lt, eq);
			expect(c).to.not.equal(a);
			expect(d).to.equal(a);
			expect(d).to.not.equal(e);
		});

	});

	describe('test', () => {

		console.log(q.createCollection('test', 'bob').columns(
			q.column('id', 'UInt64', 1, true),
			q.column('name', 'String'),
			q.column('age', 'UInt8'),
			q.column('sex', 'Bit'),
			q.column('birthdate', 'Date')
		).toString());

		console.log(q.dropCollection('test', 'bob').toString());

		console.log(q.createIndex(
			q.index('id', 'primary').columns('id', 'asc'),
			q.collection('test', 'bob')
		).toString());

		console.log(q.createIndex(
			q.index('birthdate', 'index')
				.columns('birthdate', 'asc')
				.columns('id', 'asc'),
			q.collection('test', 'bob')
		).toString());

	});

	// describe('SelectQuery', () => {

	// 	it('select', () => {
	// 		expect(q.select()).to.be.an.instanceof(SelectQuery);
	// 		expect(q.select('a', 'b', 'c').select().toJS()).to.deep.equal([{ _name: 'a' }, { _name: 'b' }, { _name: 'c' }]);
	// 		expect(q.select('a', 'b', 'c').select('a').select().toJS()).to.deep.equal([{ _name: 'a' }]);
	// 	});

	// 	it('from', () => {
	// 		expect(q.select().from('Foo').getFrom()).to.deep.equal({name: 'Foo', namespace: undefined });
	// 		expect(q.select().from('Foo', 'Bar').getFrom()).to.deep.equal({name: 'Foo', namespace: 'Bar' });
	// 	});

	// 	it('join', () => {
	// 		const query = q.select();
	// 		const on = q.eq('foo', q.field('baz'));
	// 		expect(q.select().join('Foo', query, on).getJoin()).to.deep.equal({ Foo: { query: query, on: on } });
	// 	});

	// 	it('where', () => {
	// 		expect(q.select().where(q.and([q.eq('foo', 'bar'), q.ne('foo', 'bar')])).getWhere()).to.be.deep.equal({
	// 			operator: 'and',
	// 			queries: [
	// 				{ field: 'foo', operator: '=', value: 'bar' },
	// 				{ field: 'foo', operator: '!=', value: 'bar' }
	// 			]
	// 		});
	// 		expect(q.select().where(q.or([q.eq('foo', 'bar'), q.ne('foo', 'bar')])).getWhere()).to.be.deep.equal({
	// 			operator: 'or',
	// 			queries: [
	// 				{ field: 'foo', operator: '=', value: 'bar' },
	// 				{ field: 'foo', operator: '!=', value: 'bar' }
	// 			]
	// 		});
	// 		expect(q.select().where(q.xor([q.eq('foo', 'bar'), q.ne('foo', 'bar')])).getWhere()).to.be.deep.equal({
	// 			operator: 'xor',
	// 			queries: [
	// 				{ field: 'foo', operator: '=', value: 'bar' },
	// 				{ field: 'foo', operator: '!=', value: 'bar' }
	// 			]
	// 		});

	// 		expect(q.select().eq('foo', 'bar').getWhere()).to.be.deep.equal({
	// 			operator: 'and',
	// 			queries: [
	// 				{ field: 'foo', operator: '=', value: 'bar' }
	// 			]
	// 		});
	// 	});

	// 	it('sort', () => {
	// 		expect(q.select().sort('foo').getSort()).to.be.deep.equal([
	// 			{ name: 'foo', direction: undefined }
	// 		]);
	// 		expect(q.select().sort(q.sort('foo', 'desc')).getSort()).to.be.deep.equal([
	// 			{ name: 'foo', direction: 'desc' }
	// 		]);
	// 		expect(q.select().sort(q.sort('foo', 'asc'), q.sort('baz', 'desc')).getSort()).to.be.deep.equal([
	// 			{ name: 'foo', direction: 'asc' },
	// 			{ name: 'baz', direction: 'desc' }
	// 		]);
	// 	});

	// 	it('offset', () => {
	// 		expect(q.select().offset(0).getOffset()).to.be.equal(0);
	// 		expect(q.select().offset(2).getOffset()).to.be.equal(2);
	// 		expect(() => { q.select().offset(-1).getOffset() }).to.throw(Error);
	// 	});

	// 	it('limit', () => {
	// 		expect(q.select().limit(2).getLimit()).to.be.equal(2);
	// 		expect(() => { q.select().limit(0).getLimit() }).to.throw(Error);
	// 		expect(() => { q.select().limit(-1).getLimit() }).to.throw(Error);
	// 	});

	// });

	// describe('AggregateQuery', () => {

	// 	it('select', () => {
	// 		const count = q.count('foo');
	// 		const avg = q.avg('foo');
	// 		expect(q.aggregate({ foo: count, bar: avg }).getSelect()).to.deep.equal({
	// 			foo: count,
	// 			bar: avg
	// 		});
	// 	});

	// 	it('from', () => {
	// 		expect(q.aggregate({ total: q.count('foo') }).from('Foo').getFrom()).to.deep.equal({name: 'Foo', namespace: undefined });
	// 		expect(q.aggregate({ total: q.count('foo') }).from('Foo', 'Bar').getFrom()).to.deep.equal({name: 'Foo', namespace: 'Bar' });
	// 	});

	// 	it('join', () => {
	// 		const query = q.select();
	// 		const on = q.eq('foo', q.field('baz'));
	// 		expect(q.aggregate({ total: q.count('foo') }).join('Foo', query, on).getJoin()).to.deep.equal({ Foo: { query: query, on: on } });
	// 	});

	// });

});