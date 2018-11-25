import 'mocha';
import { expect } from 'chai';
import { q, Field } from '../src/Query';
import { simplifyBinaryTree, decomposeBinaryTree, replaceField } from '../src/Utils';
import { List } from 'immutable';

describe('Utils', () => {

	it('simplifyBinaryTree', async () => {
		const a = q.and(q.and(q.eq('foo', 'bar'), q.gt('age', 21)), q.eq('gender', 'male'));
		expect(a.toString()).to.equal('((foo = bar AND age > 21) AND gender = male)');

		const b = simplifyBinaryTree(a);
		expect(a).to.not.equal(b);
		expect(b.toString()).to.equal('(foo = bar AND age > 21 AND gender = male)');
	});

	it('decomposeBinaryTree', async () => {
		const a = q.and(q.or(q.eq('foo', 'bar'), q.gt('age', 21)), q.eq('gender', 'male'));
		expect(a.toString()).to.equal('((foo = bar OR age > 21) AND gender = male)');

		const b = decomposeBinaryTree(a);
		expect(a).to.not.equal(b);
		expect(b.length).to.equal(2);
		expect(b[0].toString()).to.equal('(foo = bar AND gender = male)');
		expect(b[1].toString()).to.equal('(age > 21 AND gender = male)');
	});

	it('renameField', async () => {

		const a = List([
			q.field('foo'),
			q.field('foo', 'bar'),
			q.field('moo')
		]);
		const b = List([
			q.sort('foo'),
			q.sort(q.field('foo', 'bar')),
			q.sort('moo')
		]);
		const c = List([{
			alias: 'foo',
			on: q.and<any>(q.eq(q.field('foo', 'bar'), 'bar'), q.gt('age', 21)),
			query: q.select('foo', q.field('foo'), q.field('foo', 'bar')).from('test')
		}]);

		let matches: Field[] = [];
		const aa = replaceField(a, new Map([
			[q.field('foo', 'bar'), q.field('foo2')]
		]), matches);
		expect(matches.length).to.equal(1);
		expect(matches[0].name).to.equal('foo');
		expect(matches[0].alias).to.equal('bar');
		expect(aa).to.not.equal(a);
		expect(replaceField(a, new Map())).to.equal(a);
		expect(aa.get(0).name).to.equal('foo');
		expect(aa.get(0).alias).to.equal(undefined);
		expect(aa.get(1).name).to.equal('foo2');
		expect(aa.get(1).alias).to.equal(undefined);
		expect(aa.get(2).name).to.equal('moo');
		expect(aa.get(2).alias).to.equal(undefined);

		const bb = replaceField(b, new Map([
			[q.field('foo', 'bar'), q.field('foo2')]
		]));
		expect(bb).to.not.equal(b);
		expect(replaceField(b, new Map())).to.equal(b);
		expect(bb.get(0).direction).to.equal('asc');
		expect(bb.get(0).field.name).to.equal('foo');
		expect(bb.get(0).field.alias).to.equal(undefined);
		expect(bb.get(1).direction).to.equal('asc');
		expect(bb.get(1).field.name).to.equal('foo2');
		expect(bb.get(1).field.alias).to.equal(undefined);
		expect(bb.get(2).direction).to.equal('asc');
		expect(bb.get(2).field.name).to.equal('moo');
		expect(bb.get(2).field.alias).to.equal(undefined);

		matches = [];
		const cc = replaceField(c, new Map([
			[q.field('foo', 'bar'), q.field('foo2')]
		]), matches);
		expect(matches.length).to.equal(1);
		expect(matches[0].name).to.equal('foo');
		expect(matches[0].alias).to.equal('bar');
		expect(cc).to.not.equal(c);
		expect(replaceField(c, new Map())).to.equal(c);
		expect(cc.get(0).alias).to.equal('foo');
		expect(cc.get(0).on.toString()).to.equal('(foo2 = bar AND age > 21)');

	});

});