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
const Query_1 = require("./Query");
const Utils_1 = require("./Utils");
const immutable_1 = require("immutable");
describe('Utils', () => {
    it('simplifyBinaryTree', () => __awaiter(this, void 0, void 0, function* () {
        const a = Query_1.q.and(Query_1.q.and(Query_1.q.eq('foo', 'bar'), Query_1.q.gt('age', 21)), Query_1.q.eq('gender', 'male'));
        chai_1.expect(a.toString()).to.equal('((foo = bar AND age > 21) AND gender = male)');
        const b = Utils_1.simplifyBinaryTree(a);
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(b.toString()).to.equal('(foo = bar AND age > 21 AND gender = male)');
    }));
    it('decomposeBinaryTree', () => __awaiter(this, void 0, void 0, function* () {
        const a = Query_1.q.and(Query_1.q.or(Query_1.q.eq('foo', 'bar'), Query_1.q.gt('age', 21)), Query_1.q.eq('gender', 'male'));
        chai_1.expect(a.toString()).to.equal('((foo = bar OR age > 21) AND gender = male)');
        const b = Utils_1.decomposeBinaryTree(a);
        chai_1.expect(a).to.not.equal(b);
        chai_1.expect(b.length).to.equal(2);
        chai_1.expect(b[0].toString()).to.equal('(foo = bar AND gender = male)');
        chai_1.expect(b[1].toString()).to.equal('(age > 21 AND gender = male)');
    }));
    it('renameField', () => __awaiter(this, void 0, void 0, function* () {
        const a = immutable_1.List([
            Query_1.q.field('foo'),
            Query_1.q.field('foo', 'bar'),
            Query_1.q.field('moo')
        ]);
        const b = immutable_1.List([
            Query_1.q.sort('foo'),
            Query_1.q.sort(Query_1.q.field('foo', 'bar')),
            Query_1.q.sort('moo')
        ]);
        const c = immutable_1.List([{
                alias: 'foo',
                on: Query_1.q.and(Query_1.q.eq(Query_1.q.field('foo', 'bar'), 'bar'), Query_1.q.gt('age', 21)),
                query: Query_1.q.select('foo', Query_1.q.field('foo'), Query_1.q.field('foo', 'bar')).from('test')
            }]);
        let matches = [];
        const aa = Utils_1.replaceField(a, new Map([
            [Query_1.q.field('foo', 'bar'), Query_1.q.field('foo2')]
        ]), matches);
        chai_1.expect(matches.length).to.equal(1);
        chai_1.expect(matches[0].name).to.equal('foo');
        chai_1.expect(matches[0].alias).to.equal('bar');
        chai_1.expect(aa).to.not.equal(a);
        chai_1.expect(Utils_1.replaceField(a, new Map())).to.equal(a);
        chai_1.expect(aa.get(0).name).to.equal('foo');
        chai_1.expect(aa.get(0).alias).to.equal(undefined);
        chai_1.expect(aa.get(1).name).to.equal('foo2');
        chai_1.expect(aa.get(1).alias).to.equal(undefined);
        chai_1.expect(aa.get(2).name).to.equal('moo');
        chai_1.expect(aa.get(2).alias).to.equal(undefined);
        const bb = Utils_1.replaceField(b, new Map([
            [Query_1.q.field('foo', 'bar'), Query_1.q.field('foo2')]
        ]));
        chai_1.expect(bb).to.not.equal(b);
        chai_1.expect(Utils_1.replaceField(b, new Map())).to.equal(b);
        chai_1.expect(bb.get(0).direction).to.equal('asc');
        chai_1.expect(bb.get(0).field.name).to.equal('foo');
        chai_1.expect(bb.get(0).field.alias).to.equal(undefined);
        chai_1.expect(bb.get(1).direction).to.equal('asc');
        chai_1.expect(bb.get(1).field.name).to.equal('foo2');
        chai_1.expect(bb.get(1).field.alias).to.equal(undefined);
        chai_1.expect(bb.get(2).direction).to.equal('asc');
        chai_1.expect(bb.get(2).field.name).to.equal('moo');
        chai_1.expect(bb.get(2).field.alias).to.equal(undefined);
        matches = [];
        const cc = Utils_1.replaceField(c, new Map([
            [Query_1.q.field('foo', 'bar'), Query_1.q.field('foo2')]
        ]), matches);
        chai_1.expect(matches.length).to.equal(1);
        chai_1.expect(matches[0].name).to.equal('foo');
        chai_1.expect(matches[0].alias).to.equal('bar');
        chai_1.expect(cc).to.not.equal(c);
        chai_1.expect(Utils_1.replaceField(c, new Map())).to.equal(c);
        chai_1.expect(cc.get(0).alias).to.equal('foo');
        chai_1.expect(cc.get(0).on.toString()).to.equal('(foo2 = bar AND age > 21)');
    }));
});
//# sourceMappingURL=Utils.spec.js.map