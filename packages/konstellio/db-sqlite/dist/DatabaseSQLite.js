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
const db_1 = require("@konstellio/db");
const immutable_1 = require("immutable");
const sqlite3_1 = require("sqlite3");
function runQuery(driver, sql, params = []) {
    return new Promise((resolve, reject) => {
        driver.driver.run(sql, params, function (err) {
            if (err)
                return reject(err);
            resolve({
                changes: this.changes,
                lastId: this.lastID.toString()
            });
        });
    });
}
function allQuery(driver, sql, params = []) {
    return new Promise((resolve, reject) => {
        driver.driver.all(sql, params, function (err, results) {
            if (err)
                return reject(err);
            resolve(results);
        });
    });
}
class DatabaseSQLite extends db_1.Database {
    constructor(options) {
        super();
        this.options = options;
        this.features = {
            join: true
        };
    }
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.driver = new sqlite3_1.Database(this.options.filename, this.options.mode || (sqlite3_1.OPEN_READWRITE | sqlite3_1.OPEN_CREATE), (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(this);
                });
            }
            catch (e) {
                throw new Error(`Could not load sqlite3 client. Maybe try "npm install sqlite3" ?`);
            }
        });
    }
    execute(query, variables) {
        if (typeof query === 'string') {
            return this.executeSQL(query, variables);
        }
        else if (query instanceof db_1.QuerySelect) {
            return this.executeSelect(query, variables);
        }
        else if (query instanceof db_1.QueryAggregate) {
            return this.executeAggregate(query, variables);
        }
        else if (query instanceof db_1.QueryUnion) {
            return this.executeUnion(query, variables);
        }
        else if (query instanceof db_1.QueryInsert) {
            return this.executeInsert(query, variables);
        }
        else if (query instanceof db_1.QueryUpdate) {
            return this.executeUpdate(query, variables);
        }
        else if (query instanceof db_1.QueryDelete) {
            return this.executeDelete(query, variables);
        }
        else if (query instanceof db_1.QueryDescribeCollection) {
            return this.executeDescribeCollection(query);
        }
        else if (query instanceof db_1.QueryCreateCollection) {
            return this.executeCreateCollection(query);
        }
        else if (query instanceof db_1.QueryAlterCollection) {
            return this.executeAlterCollection(query);
        }
        else if (query instanceof db_1.QueryCollectionExists) {
            return this.executeCollectionExists(query);
        }
        else if (query instanceof db_1.QueryDropCollection) {
            return this.executeDropCollection(query);
        }
        else if (query instanceof db_1.QueryShowCollection) {
            return this.executeShowCollection();
        }
        return Promise.reject(new TypeError(`Unsupported query, got ${typeof query}.`));
    }
    // @ts-ignore
    compareTypes(aType, aSize, bType, bSize) {
        if (columnType(aType) === columnType(bType)) {
            return db_1.Compare.Castable;
        }
        return db_1.Compare.Different;
    }
    executeSQL(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            if (query.replace(/^[\s(]+/, '').substr(0, 5).toUpperCase() === 'SELECT') {
                return new db_1.QuerySelectResult(yield allQuery(this, query, variables));
            }
            else {
                return runQuery(this, query);
            }
        });
    }
    executeSelect(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const stmts = convertQueryToSQL(query, variables);
            const rows = yield allQuery(this, stmts[0].sql, stmts[0].params);
            return new db_1.QuerySelectResult(rows);
        });
    }
    executeAggregate(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const stmts = convertQueryToSQL(query, variables);
            const rows = yield allQuery(this, stmts[0].sql, stmts[0].params);
            return new db_1.QuerySelectResult(rows);
        });
    }
    executeUnion(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const stmts = convertQueryToSQL(query, variables);
            const rows = yield allQuery(this, stmts[0].sql, stmts[0].params);
            return new db_1.QuerySelectResult(rows);
        });
    }
    executeInsert(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const stmts = convertQueryToSQL(query, variables);
            const { lastId } = yield runQuery(this, stmts[0].sql, stmts[0].params);
            return new db_1.QueryInsertResult(lastId.toString());
        });
    }
    executeUpdate(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const stmts = convertQueryToSQL(query, variables);
            yield runQuery(this, stmts[0].sql, stmts[0].params);
            const fields = query.object;
            const data = fields ? fields.toJS() : {};
            return new db_1.QueryUpdateResult(data);
        });
    }
    executeDelete(query, variables) {
        return __awaiter(this, void 0, void 0, function* () {
            const stmts = convertQueryToSQL(query, variables);
            const { changes } = yield runQuery(this, stmts[0].sql, stmts[0].params);
            return new db_1.QueryDeleteResult(changes > 0);
        });
    }
    executeShowCollection() {
        return __awaiter(this, void 0, void 0, function* () {
            return allQuery(this, `SELECT name FROM sqlite_master WHERE type="table"`).then((tables) => {
                return new db_1.QueryShowCollectionResult(tables.filter(({ name }) => name !== 'sqlite_sequence').map(({ name }) => {
                    const match = name.match(/^([^_]+)_(.*)$/);
                    if (match) {
                        return db_1.q.collection(match[2], match[1]);
                    }
                    return db_1.q.collection(name);
                }));
            });
        });
    }
    executeDescribeCollection(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = query.collection;
            if (!collection) {
                throw new Error(`Expected QueryDescribeCollection to be from a collection.`);
            }
            const table_name = collectionToSQL(query.collection);
            const [colDefs, idxDefs, auto] = yield Promise.all([
                allQuery(this, `PRAGMA table_info(${table_name})`, [])
                    .catch(() => []),
                allQuery(this, `PRAGMA index_list(${table_name})`, [])
                    .then(indexes => Promise.all(indexes.map(index => allQuery(this, `PRAGMA index_xinfo(${index.name})`, []).then(columns => ({
                    name: index.name,
                    type: index.unique ? 'unique' : 'index',
                    columns: columns || []
                })))))
                    .then(indexes => indexes.filter(idx => idx.name.substr(0, 17) !== 'sqlite_autoindex_'))
                    .catch(() => []),
                allQuery(this, `SELECT "auto" FROM sqlite_master WHERE tbl_name=? AND sql LIKE "%AUTOINCREMENT%"`, [table_name])
                    .then(rows => rows.length > 0)
                    .catch(() => false)
            ]);
            const columns = colDefs.map(col => {
                let type = db_1.ColumnType.Text;
                let size = -1;
                switch (col.type) {
                    case 'TEXT': break;
                    case 'INTEGER':
                        type = db_1.ColumnType.Int;
                        size = 64;
                        break;
                    case 'REAL':
                    case 'NUMERIC':
                        type = db_1.ColumnType.Float;
                        size = 64;
                        break;
                    case 'BLOB':
                        type = db_1.ColumnType.Blob;
                        break;
                }
                return new db_1.Column(col.name, type, size, col.dflt_value, col.pk ? auto : false);
            });
            const indexes = idxDefs.map(idx => {
                let type = db_1.IndexType.Index;
                switch (idx.type) {
                    case 'unique':
                        type = db_1.IndexType.Unique;
                        break;
                }
                const cols = idx.columns.filter(col => col.cid > -1).sort((a, b) => a.seqno - b.seqno);
                const columns = immutable_1.List(cols.map(col => {
                    return new db_1.FieldDirection(db_1.q.field(col.name), col.desc ? 'desc' : 'asc');
                }));
                return new db_1.Index(idx.name, type, columns);
            });
            const primaryKeys = colDefs.filter(col => col.pk).map(col => db_1.q.index(`${table_name}_${col.name}`, db_1.IndexType.Primary, [db_1.q.sort(col.name, 'asc')]));
            return new db_1.QueryDescribeCollectionResult(collection, columns, primaryKeys.concat(indexes));
        });
    }
    executeCreateCollection(query) {
        return new Promise((resolve, reject) => {
            // https://sqlite.org/lang_transaction.html
            // Return a list of lambda that return a promise
            const stmts = convertQueryToSQL(query).map(stmt => () => new Promise((resolve, reject) => {
                this.driver.run(stmt.sql, stmt.params, function (err) {
                    if (err)
                        return reject(err);
                    // if (this.changes === 0) return reject(new Error(`No changes were made.`));
                    resolve();
                });
            }));
            // Run promise one after the other
            stmts.reduce((last, stmt) => last.then(stmt), Promise.resolve())
                .then(() => {
                const result = new db_1.QueryCreateCollectionResult(true);
                resolve(result);
            })
                .catch(reject);
        });
    }
    executeAlterCollection(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = query.collection;
            if (!collection) {
                throw new Error(`Expected QueryAlterCollection to be from a collection.`);
            }
            if (!query.changes && !query.renamed) {
                throw new Error(`Expected QueryAlterCollection to contains at least 1 change.`);
            }
            const changes = immutable_1.List(query.changes || []);
            const description = yield this.executeDescribeCollection(db_1.q.describeCollection(collection));
            const existingColumns = description.columns.filter(column => {
                return changes.findIndex(c => c !== undefined && c.type === 'dropColumn' && c.column === column.name) === -1;
            });
            const newColumns = changes.filter((change) => {
                return change !== undefined && change.type === 'addColumn';
            }).map((change) => change.column).toArray();
            const copyColumns = changes.filter(change => {
                return change !== undefined && change.type === 'addColumn' && change.copyColumn !== undefined;
            }).toArray();
            const renameColumns = changes.reduce((columns, change) => {
                if (change && change.type === 'alterColumn') {
                    columns[change.oldColumn] = change.newColumn;
                }
                return columns;
            }, {});
            const tmpTable = `konstellio_db_rename_${++DatabaseSQLite.tmpId}`;
            const create = db_1.q.createCollection(tmpTable).define(existingColumns.map(col => renameColumns[col.name] ? renameColumns[col.name] : col).concat(newColumns), []);
            const finalCollection = query.renamed || collection;
            const insertColumns = existingColumns.map(col => {
                const source = col.name;
                const renamed = renameColumns[source] ? renameColumns[source] : col;
                return {
                    target: renamed.name,
                    source: source
                };
            }).concat(copyColumns.map(change => {
                return {
                    target: change.column.name,
                    source: change.copyColumn
                };
            }));
            yield this.executeCreateCollection(create);
            yield runQuery(this, `INSERT INTO ${tmpTable} (${insertColumns.map(col => `"${col.target}"`).join(', ')}) SELECT ${insertColumns.map(col => `"${col.source}"`).join(', ')} FROM ${collectionToSQL(collection)}`, []);
            yield runQuery(this, `DROP TABLE ${collectionToSQL(collection)}`, []);
            yield runQuery(this, `ALTER TABLE ${tmpTable} RENAME TO ${collectionToSQL(finalCollection)}`, []);
            const existingIndexes = description.indexes.filter(index => {
                return changes.findIndex(c => c !== undefined && (index.type === db_1.IndexType.Primary || (c.type === 'dropIndex' && c.index === index.name))) === -1;
            });
            const renamedIndexes = query.renamed
                ? existingIndexes.map(index => new db_1.Index(index.name.replace(`${collectionToString(collection)}_`, `${collectionToString(finalCollection)}_`), index.type, index.columns))
                : existingIndexes;
            const newIndexes = changes.filter((change) => {
                return change !== undefined && change.type === 'addIndex';
            }).map((change) => change.index).toArray();
            yield Promise.all(renamedIndexes.concat(newIndexes).map(index => runQuery(this, indexToSQL(finalCollection, index))));
            return new db_1.QueryAlterCollectionResult(true);
        });
    }
    executeCollectionExists(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = query.collection;
            if (!collection) {
                throw new Error(`Expected QueryCollectionExists to be from a collection.`);
            }
            try {
                const info = yield allQuery(this, `PRAGMA table_info(${collectionToSQL(collection)})`, []);
                return new db_1.QueryCollectionExistsResult(info.length > 0);
            }
            catch (e) {
                return new db_1.QueryCollectionExistsResult(false);
            }
        });
    }
    executeDropCollection(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const collection = query.collection;
            if (!collection) {
                throw new Error(`Expected QueryDropCollection to be from a collection.`);
            }
            try {
                yield runQuery(this, `DROP TABLE ${collectionToSQL(collection)}`, []);
                return new db_1.QueryDropCollectionResult(true);
            }
            catch (e) {
                return new db_1.QueryDropCollectionResult(false);
            }
        });
    }
}
DatabaseSQLite.tmpId = 0;
exports.DatabaseSQLite = DatabaseSQLite;
function collectionToString(collection) {
    return `${collection.namespace ? `${collection.namespace}_` : ''}${collection.name}`;
}
function collectionToSQL(collection) {
    return `"${collectionToString(collection)}"`;
}
function fieldToSQL(field, params, variables) {
    if (field instanceof db_1.Field) {
        return `"${field.alias ? `${field.alias}.` : ''}${field.name}"`;
    }
    else if (field instanceof db_1.FieldAs) {
        if (field.field instanceof db_1.Function) {
            return `"${fnToSQL(field.field, params, variables)}" AS "${field.alias}"`;
        }
        else {
            return `"${field.field.toString()}" AS "${field.alias}"`;
        }
    }
    else {
        return `"${field.field.toString()}" ${field.direction.toUpperCase() || 'ASC'}`;
    }
}
function fnToSQL(field, params, variables) {
    return `${field.fn.toUpperCase()}(${field.args.map(field => {
        return field ? (field instanceof db_1.Field ? fieldToSQL(field, params, variables) : valueToSQL(field, params, variables)) : '';
    }).join(', ')})`;
}
function valueToSQL(field, params, variables) {
    if (field instanceof db_1.Field) {
        return fieldToSQL(field, params, variables);
    }
    else if (field instanceof db_1.Function) {
        return fnToSQL(field, params, variables);
    }
    else if (field instanceof db_1.Variable) {
        if (variables === undefined || typeof variables[field.name] === 'undefined') {
            throw new Error(`Could not find query variable ${field.name}.`);
        }
        params.push(variables[field.name]);
        return '?';
    }
    else if (field) {
        params.push(field);
        return '?';
    }
    return '';
}
function comparisonToSQL(comparison, params, variables) {
    if (comparison instanceof db_1.ComparisonIn) {
        return `${comparison.field instanceof db_1.Field ? fieldToSQL(comparison.field, params, variables) : fnToSQL(comparison.field, params, variables)} IN (${comparison.args.map(arg => valueToSQL(arg, params, variables)).join(', ')})`;
    }
    else {
        return `${comparison.field instanceof db_1.Field ? fieldToSQL(comparison.field, params, variables) : fnToSQL(comparison.field, params, variables)} ${comparison.operator} ${valueToSQL(comparison.args.get(0), params, variables)}`;
    }
}
function binaryToSQL(bitwise, params, variables) {
    if (bitwise.operands) {
        return `(${bitwise.operands.map(op => {
            if (op instanceof db_1.Comparison) {
                return comparisonToSQL(op, params, variables);
            }
            else if (op instanceof db_1.Binary) {
                return binaryToSQL(op, params, variables);
            }
            return '';
        }).join(` ${bitwise.operator.toUpperCase()} `)})`;
    }
    else {
        return '';
    }
}
function selectQueryToSQL(query, variables) {
    const params = [];
    let sql = ``;
    sql += `SELECT ${query.fields && query.fields.count() > 0 ? query.fields.map(f => f ? fieldToSQL(f, params, variables) : '').join(', ') : '*'}`;
    if (query.collection) {
        sql += ` FROM ${collectionToSQL(query.collection)}`;
    }
    else {
        throw new Error(`Expected QuerySelect to be from a collection.`);
    }
    if (query.joins) {
        query.joins.forEach((join, alias) => {
            const joinStm = convertQueryToSQL(join.query, variables);
            params.push(...joinStm[0].params);
            sql += ` JOIN (${joinStm[0].sql}) AS ${alias} ON ${join.on}`;
        });
    }
    if (query.conditions) {
        sql += ` WHERE ${binaryToSQL(query.conditions, params, variables)}`;
    }
    if (query.sorts) {
        sql += ` ORDER BY ${query.sorts.map(sort => sort ? fieldToSQL(sort, params, variables) : '').join(', ')}`;
    }
    if (query.limit) {
        sql += ` LIMIT ${query.limit}`;
    }
    if (query.offset) {
        sql += ` OFFSET ${query.offset}`;
    }
    return {
        sql,
        params
    };
}
function indexToSQL(collection, index) {
    const cols = index.columns;
    if (!cols || cols.count() === 0) {
        throw new Error(`Expected index ${index.name} to contain at least 1 column.`);
    }
    let def = `CREATE `;
    if (index.type === db_1.IndexType.Unique) {
        def += `UNIQUE `;
    }
    def += `INDEX ${index.name} ON ${collectionToSQL(collection)} (${cols.map(col => col !== undefined ? fieldToSQL(col, []) : '').join(', ')})`;
    return def;
}
function columnType(type) {
    switch (type) {
        case db_1.ColumnType.Bit:
        case db_1.ColumnType.Boolean:
        case db_1.ColumnType.UInt:
        case db_1.ColumnType.Int:
            return 'INTEGER';
        case db_1.ColumnType.Float:
            return 'REAL';
        case db_1.ColumnType.Blob:
            return 'BLOB';
        default:
            return 'TEXT';
    }
}
function convertQueryToSQL(query, variables) {
    if (query instanceof db_1.QuerySelect) {
        return [selectQueryToSQL(query, variables)];
    }
    else if (query instanceof db_1.QueryUnion) {
        const params = [];
        let sql = ``;
        if (query.selects) {
            sql += `(${query.selects.map(subquery => {
                if (subquery) {
                    const stmt = convertQueryToSQL(subquery, variables);
                    params.push(...stmt[0].params);
                    return stmt[0].sql;
                }
                throw new Error(`Expected a QuerySelect, got ${typeof subquery}.`);
            }).join(') UNION (')})`;
        }
        else {
            throw new Error(`Expected QueryUnion have at least 1 Select`);
        }
        if (query.sorts) {
            sql += ` ORDER BY ${query.sorts.map(sort => sort ? fieldToSQL(sort, params, variables) : '').join(', ')}`;
        }
        if (query.limit) {
            sql += ` LIMIT ${query.limit}`;
        }
        if (query.offset) {
            sql += ` OFFSET ${query.offset}`;
        }
        return [{ sql, params }];
    }
    else if (query instanceof db_1.QueryAggregate) {
        const params = [];
        let sql = ``;
        sql += `SELECT ${query.fields && query.fields.count() > 0 ? query.fields.map(f => f ? fieldToSQL(f, params, variables) : '').join(', ') : '*'}`;
        if (query.collection) {
            sql += ` FROM ${collectionToSQL(query.collection)}`;
        }
        else {
            throw new Error(`Expected QuerySelect to be from a collection.`);
        }
        if (query.joins) {
            query.joins.forEach(join => {
                const joinStm = convertQueryToSQL(join.query, variables);
                params.push(...joinStm[0].params);
                sql += ` JOIN (${joinStm[0].sql}) AS ${join.alias} ON ${join.on}`;
            });
        }
        if (query.conditions) {
            sql += ` WHERE ${binaryToSQL(query.conditions, params, variables)}`;
        }
        if (query.groups) {
            sql += ` GROUP BY ${query.groups.map(field => field instanceof db_1.Field ? fieldToSQL(field, params, variables) : fnToSQL(field, params, variables)).join(', ')}`;
        }
        if (query.sorts) {
            sql += ` ORDER BY ${query.sorts.map(sort => sort ? fieldToSQL(sort, params, variables) : '').join(', ')}`;
        }
        if (query.limit) {
            sql += ` LIMIT ${query.limit}`;
        }
        if (query.offset) {
            sql += ` OFFSET ${query.offset}`;
        }
        return [{ sql, params }];
    }
    else if (query instanceof db_1.QueryInsert) {
        const params = [];
        let sql = ``;
        if (query.collection) {
            sql += `INSERT INTO ${collectionToSQL(query.collection)}`;
        }
        else {
            throw new Error(`Expected QueryInsert to be from a collection.`);
        }
        const objects = query.objects;
        if (objects !== undefined && objects.count() > 0) {
            sql += `(${objects.get(0).map((_, key) => `"${key}"`).join(', ')}) `;
            sql += `VALUES ${objects.map(obj => {
                return `(${obj.map(value => {
                    params.push(value);
                    return '?';
                }).join(', ')})`;
            }).join(', ')}`;
        }
        else {
            throw new Error(`Expected QueryInsert to have some data.`);
        }
        return [{ sql, params }];
    }
    else if (query instanceof db_1.QueryUpdate) {
        const params = [];
        let sql = ``;
        if (query.collection) {
            sql += `UPDATE  ${collectionToSQL(query.collection)} SET`;
        }
        else {
            throw new Error(`Expected QueryInsert to be from a collection.`);
        }
        if (query.object) {
            sql += ` ${query.object.map((value, key) => {
                params.push(value);
                return `"${key}" = ?`;
            }).join(', ')}`;
        }
        else {
            throw new Error(`Expected QueryUpdate to have some data.`);
        }
        if (query.conditions) {
            sql += ` WHERE ${binaryToSQL(query.conditions, params, variables)} `;
        }
        return [{ sql, params }];
    }
    else if (query instanceof db_1.QueryDelete) {
        const params = [];
        let sql = ``;
        if (query.collection) {
            sql += `DELETE FROM  ${collectionToSQL(query.collection)}`;
        }
        else {
            throw new Error(`Expected QueryDelete to be from a collection.`);
        }
        if (query.conditions) {
            sql += ` WHERE ${binaryToSQL(query.conditions, params, variables)} `;
        }
        return [{ sql, params }];
    }
    else if (query instanceof db_1.QueryCreateCollection) {
        const collection = query.collection;
        const columns = query.columns;
        const indexes = query.indexes;
        let params = [];
        let sql = '';
        if (collection) {
            sql += `CREATE TABLE ${collectionToSQL(query.collection)}`;
        }
        else {
            throw new Error(`Expected QueryCreateCollection to be from a collection.`);
        }
        if (columns === undefined || columns.count() === 0) {
            throw new Error(`Expected QueryCreateCollection to have at least one column, got none.`);
        }
        const autoCol = columns.filter(col => col !== undefined && col.autoIncrement === true);
        const primaryKeys = indexes ? indexes.filter(idx => idx !== undefined && idx.type === db_1.IndexType.Primary) : immutable_1.List();
        const otherIndexes = indexes ? indexes.filter(idx => idx !== undefined && idx.type !== db_1.IndexType.Primary) : immutable_1.List();
        // if (
        // 	autoCol.count() > 0 && (
        // 	primaryKeys.count() != 1 ||
        // 	primaryKeys.get(0).columns === undefined ||
        // 	primaryKeys.get(0).columns!.filter(col => col!.name === autoCol.get(0).name).count() === 0)
        // ) {
        // 	throw new Error(`Expected QueryCreateCollection to have a single autoincrement column with a corresponding primary index. ${autoCol.count()} ${primaryKeys.count()}`);
        // }
        if (primaryKeys.count() > 1) {
            throw new Error(`Expected QueryCreateCollection to have a single primary key index. This index can be on multiple columns.`);
        }
        const autoColName = autoCol && autoCol.count() > 0 && autoCol.get(0).name;
        sql += ` (${columns.map(col => {
            if (col !== undefined) {
                const defaultValue = col.defaultValue;
                let def = `"${col.name}" ${columnType(col.type)}`;
                if (col.name === autoColName) {
                    def += ` PRIMARY KEY AUTOINCREMENT`;
                }
                if (defaultValue !== undefined && defaultValue !== null) {
                    def += ` DEFAULT ${typeof defaultValue === 'number' ? defaultValue : `'${defaultValue}'`}`;
                }
                return def;
            }
            return '';
        }).join(', ')}`;
        if (!autoColName && primaryKeys.count() > 0) {
            const cols = primaryKeys.get(0).columns;
            if (cols) {
                sql += `, PRIMARY KEY (${cols.map(col => col !== undefined ? col.toString() : '').join(', ')})`;
            }
        }
        sql += `)`;
        const stmts = [{ sql, params }];
        if (otherIndexes && otherIndexes.count() > 0) {
            otherIndexes.forEach(idx => {
                if (idx !== undefined) {
                    stmts.push({ sql: indexToSQL(collection, idx), params: [] });
                }
            });
        }
        return stmts;
    }
    else {
        return [];
    }
}
exports.convertQueryToSQL = convertQueryToSQL;
//# sourceMappingURL=DatabaseSQLite.js.map