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
chai_1.use(require("chai-as-promised"));
chai_1.should();
const DatabaseSQLite_1 = require("./DatabaseSQLite");
const db_1 = require("@konstellio/db");
describe('SQLite', () => {
    let driver;
    before(function (done) {
        this.timeout(10000);
        // unlinkSync('./kdb.sqlite');
        driver = new DatabaseSQLite_1.DatabaseSQLite({
            filename: ':memory:'
            // filename: './kdb.sqlite'
        });
        driver.connect()
            .then(() => driver.execute('CREATE TABLE Bar_Foo (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, postDate TEXT, likes INTEGER)'))
            .then(() => driver.execute('CREATE INDEX Bar_Foo_postDate ON Bar_Foo (postDate ASC, likes ASC)'))
            .then(() => driver.execute('CREATE INDEX Bar_Foo_title ON Bar_Foo (title ASC)'))
            .then(() => done()).catch(done);
    });
    it('insert', () => __awaiter(this, void 0, void 0, function* () {
        const result = yield driver.execute(db_1.q.insert(db_1.q.collection('Foo', 'Bar')).add({
            title: 'Hello world',
            postDate: new Date(),
            likes: 10
        })).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryInsertResult);
        yield driver.execute(db_1.q.insert(db_1.q.collection('Foo', 'Bar')).add({
            title: 'Bye world',
            postDate: new Date(),
            likes: 10
        })).should.be.fulfilled;
    }));
    it('update', () => __awaiter(this, void 0, void 0, function* () {
        const update = db_1.q.update(db_1.q.collection('Foo', 'Bar')).set({ likes: 11 }).where(db_1.q.eq('title', 'Hello world')); //.limit(1);
        const result = yield driver.execute(update).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryUpdateResult);
    }));
    it('select', () => __awaiter(this, void 0, void 0, function* () {
        const select = db_1.q.select().from(db_1.q.collection('Foo', 'Bar')).range({ limit: 1 });
        const result = yield driver.execute(select).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QuerySelectResult);
    }));
    it('variable', () => __awaiter(this, void 0, void 0, function* () {
        const select = db_1.q.select().from(db_1.q.collection('Foo', 'Bar')).where(db_1.q.eq('title', db_1.q.var('title')));
        yield driver.execute(select).should.be.rejected;
        const result = yield driver.execute(select, { title: 'Hello world' }).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QuerySelectResult);
    }));
    it('delete', () => __awaiter(this, void 0, void 0, function* () {
        const remove = db_1.q.delete(db_1.q.collection('Foo', 'Bar')).where(db_1.q.eq('title', 'Hello world'));
        const result = yield driver.execute(remove).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryDeleteResult);
    }));
    it('describe collection', () => __awaiter(this, void 0, void 0, function* () {
        const desc = yield driver.execute(db_1.q.describeCollection(db_1.q.collection('Foo', 'Bar'))).should.be.fulfilled;
        chai_1.expect(desc).to.be.an.instanceOf(db_1.QueryDescribeCollectionResult);
        chai_1.expect(desc.columns.length).to.be.equal(4);
        chai_1.expect(desc.columns[0].name).to.be.equal('id');
        chai_1.expect(desc.columns[0].type).to.be.equal(db_1.ColumnType.Int);
        chai_1.expect(desc.columns[0].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[0].autoIncrement).to.be.equal(true);
        chai_1.expect(desc.columns[1].name).to.be.equal('title');
        chai_1.expect(desc.columns[1].type).to.be.equal(db_1.ColumnType.Text);
        chai_1.expect(desc.columns[1].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[1].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.columns[2].name).to.be.equal('postDate');
        chai_1.expect(desc.columns[2].type).to.be.equal(db_1.ColumnType.Text);
        chai_1.expect(desc.columns[2].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[2].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.columns[3].name).to.be.equal('likes');
        chai_1.expect(desc.columns[3].type).to.be.equal(db_1.ColumnType.Int);
        chai_1.expect(desc.columns[3].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[3].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.indexes.length).to.be.equal(3);
        chai_1.expect(desc.indexes[0].name).to.be.equal('Bar_Foo_id');
        chai_1.expect(desc.indexes[0].type).to.be.equal(db_1.IndexType.Primary);
        chai_1.expect(desc.indexes[0].columns.count()).to.be.equal(1);
        chai_1.expect(desc.indexes[0].columns.get(0).toString()).to.be.equal('id ASC');
        chai_1.expect(desc.indexes[1].name).to.be.equal('Bar_Foo_title');
        chai_1.expect(desc.indexes[1].type).to.be.equal(db_1.IndexType.Index);
        chai_1.expect(desc.indexes[1].columns.count()).to.be.equal(1);
        chai_1.expect(desc.indexes[1].columns.get(0).toString()).to.be.equal('title ASC');
        chai_1.expect(desc.indexes[2].name).to.be.equal('Bar_Foo_postDate');
        chai_1.expect(desc.indexes[2].type).to.be.equal(db_1.IndexType.Index);
        chai_1.expect(desc.indexes[2].columns.count()).to.be.equal(2);
        chai_1.expect(desc.indexes[2].columns.get(0).toString()).to.be.equal('postDate ASC');
        chai_1.expect(desc.indexes[2].columns.get(1).toString()).to.be.equal('likes ASC');
    }));
    it('create collection', () => __awaiter(this, void 0, void 0, function* () {
        const create = db_1.q.createCollection(db_1.q.collection('Moo', 'Joo'))
            .define([
            db_1.q.column('id', db_1.ColumnType.UInt, 64, null, true),
            db_1.q.column('title', db_1.ColumnType.Text),
            db_1.q.column('date', db_1.ColumnType.Date)
        ], [
            db_1.q.index('Joo_Moo_id', db_1.IndexType.Primary, [db_1.q.sort(db_1.q.field('id'), 'asc')]),
            db_1.q.index('Joo_Moo_date', db_1.IndexType.Unique, [db_1.q.sort(db_1.q.field('id'), 'asc'), db_1.q.sort(db_1.q.field('date'), 'desc')])
        ]);
        const result = yield driver.execute(create).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryCreateCollectionResult);
        const desc = yield driver.execute(db_1.q.describeCollection(db_1.q.collection('Moo', 'Joo'))).should.be.fulfilled;
        chai_1.expect(desc.columns.length).to.be.equal(3);
        chai_1.expect(desc.columns[0].name).to.be.equal('id');
        chai_1.expect(desc.columns[0].type).to.be.equal(db_1.ColumnType.Int);
        chai_1.expect(desc.columns[0].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[0].autoIncrement).to.be.equal(true);
        chai_1.expect(desc.columns[1].name).to.be.equal('title');
        chai_1.expect(desc.columns[1].type).to.be.equal(db_1.ColumnType.Text);
        chai_1.expect(desc.columns[1].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[1].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.columns[2].name).to.be.equal('date');
        chai_1.expect(desc.columns[2].type).to.be.equal(db_1.ColumnType.Text);
        chai_1.expect(desc.columns[2].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[2].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.indexes.length).to.be.equal(2);
        chai_1.expect(desc.indexes[0].name).to.be.equal('Joo_Moo_id');
        chai_1.expect(desc.indexes[0].type).to.be.equal(db_1.IndexType.Primary);
        chai_1.expect(desc.indexes[0].columns.count()).to.be.equal(1);
        chai_1.expect(desc.indexes[0].columns.get(0).toString()).to.be.equal('id ASC');
        chai_1.expect(desc.indexes[1].name).to.be.equal('Joo_Moo_date');
        chai_1.expect(desc.indexes[1].type).to.be.equal(db_1.IndexType.Unique);
        chai_1.expect(desc.indexes[1].columns.count()).to.be.equal(2);
        chai_1.expect(desc.indexes[1].columns.get(0).toString()).to.be.equal('id ASC');
        chai_1.expect(desc.indexes[1].columns.get(1).toString()).to.be.equal('date DESC');
    }));
    it('alter collection', () => __awaiter(this, void 0, void 0, function* () {
        const alter = db_1.q.alterCollection(db_1.q.collection('Moo', 'Joo'))
            .addColumn(db_1.q.column('content', db_1.ColumnType.Text))
            .alterColumn('date', db_1.q.column('postDate', db_1.ColumnType.Date))
            .dropColumn('title')
            .addIndex(db_1.q.index('Joo_Moo_content', db_1.IndexType.Index, [db_1.q.sort(db_1.q.field('content'), 'asc')]))
            .dropIndex('Joo_Moo_date')
            .rename(db_1.q.collection('Moo', 'Boo'));
        const result = yield driver.execute(alter).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryAlterCollectionResult);
        const desc = yield driver.execute(db_1.q.describeCollection(db_1.q.collection('Moo', 'Boo'))).should.be.fulfilled;
        chai_1.expect(desc.columns.length).to.be.equal(3);
        chai_1.expect(desc.columns[0].name).to.be.equal('id');
        chai_1.expect(desc.columns[0].type).to.be.equal(db_1.ColumnType.Int);
        chai_1.expect(desc.columns[0].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[0].autoIncrement).to.be.equal(true);
        chai_1.expect(desc.columns[1].name).to.be.equal('postDate');
        chai_1.expect(desc.columns[1].type).to.be.equal(db_1.ColumnType.Text);
        chai_1.expect(desc.columns[1].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[1].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.columns[2].name).to.be.equal('content');
        chai_1.expect(desc.columns[2].type).to.be.equal(db_1.ColumnType.Text);
        chai_1.expect(desc.columns[2].defaultValue).to.be.equal(null);
        chai_1.expect(desc.columns[2].autoIncrement).to.be.equal(false);
        chai_1.expect(desc.indexes.length).to.be.equal(2);
        chai_1.expect(desc.indexes[0].name).to.be.equal('Boo_Moo_id');
        chai_1.expect(desc.indexes[0].type).to.be.equal(db_1.IndexType.Primary);
        chai_1.expect(desc.indexes[0].columns.count()).to.be.equal(1);
        chai_1.expect(desc.indexes[0].columns.get(0).toString()).to.be.equal('id ASC');
        chai_1.expect(desc.indexes[1].name).to.be.equal('Joo_Moo_content');
        chai_1.expect(desc.indexes[1].type).to.be.equal(db_1.IndexType.Index);
        chai_1.expect(desc.indexes[1].columns.count()).to.be.equal(1);
        chai_1.expect(desc.indexes[1].columns.get(0).toString()).to.be.equal('content ASC');
    }));
    it('exists collection', () => __awaiter(this, void 0, void 0, function* () {
        let result = yield driver.execute(db_1.q.collectionExists(db_1.q.collection('Moo', 'Boo'))).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryCollectionExistsResult);
        chai_1.expect(result.exists).to.equal(true);
        result = yield driver.execute(db_1.q.collectionExists(db_1.q.collection('Foo', 'Joo'))).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryCollectionExistsResult);
        chai_1.expect(result.exists).to.equal(false);
    }));
    it('describe collection', () => __awaiter(this, void 0, void 0, function* () {
        let result = yield driver.execute(db_1.q.showCollection()).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryShowCollectionResult);
        chai_1.expect(result.collections.length).to.equal(2);
        chai_1.expect(result.collections[0].toString()).to.equal('Bar__Foo');
        chai_1.expect(result.collections[1].toString()).to.equal('Boo__Moo');
    }));
    it('drop collection', () => __awaiter(this, void 0, void 0, function* () {
        let result = yield driver.execute(db_1.q.dropCollection(db_1.q.collection('Moo', 'Boo'))).should.be.fulfilled;
        chai_1.expect(result).to.be.an.instanceOf(db_1.QueryDropCollectionResult);
        chai_1.expect(result.acknowledge).to.equal(true);
    }));
});
//# sourceMappingURL=DatabaseSQLite.spec.js.map