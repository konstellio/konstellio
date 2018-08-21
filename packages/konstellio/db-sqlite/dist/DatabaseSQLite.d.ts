import { Database, Compare, Features, QuerySelectResult, QueryAggregateResult, QueryDeleteResult, QueryInsertResult, QueryUpdateResult, QueryShowCollectionResult, QueryDescribeCollectionResult, QueryCreateCollectionResult, QueryAlterCollectionResult, QueryCollectionExistsResult, QueryDropCollectionResult, Query, QuerySelect, QueryUnion, QueryAggregate, QueryInsert, QueryUpdate, QueryDelete, QueryShowCollection, QueryDescribeCollection, QueryCreateCollection, QueryAlterCollection, QueryCollectionExists, QueryDropCollection, Variables, ColumnType } from '@konstellio/db';
import { Database as SQLite } from 'sqlite3';
export declare type DatabaseSQLiteConstructor = {
    filename: string;
    mode?: number;
    verbose?: boolean;
};
export declare type SQLiteQueryResult = {
    lastId: string;
    changes: number;
};
export declare class DatabaseSQLite extends Database {
    readonly features: Features;
    options: DatabaseSQLiteConstructor;
    driver: SQLite;
    constructor(options: DatabaseSQLiteConstructor);
    connect(): Promise<DatabaseSQLite>;
    execute(query: string, variables?: (string | number | boolean | Date | null)[]): Promise<SQLiteQueryResult>;
    execute<T>(query: QuerySelect, variables?: Variables): Promise<QuerySelectResult<T>>;
    execute<T>(query: QueryAggregate, variables?: Variables): Promise<QueryAggregateResult<T>>;
    execute<T>(query: QueryUnion, variables?: Variables): Promise<QuerySelectResult<T>>;
    execute<T>(query: QueryUpdate, variables?: Variables): Promise<QueryUpdateResult<T>>;
    execute(query: QueryInsert, variables?: Variables): Promise<QueryInsertResult>;
    execute(query: QueryDelete, variables?: Variables): Promise<QueryDeleteResult>;
    execute(query: QueryCreateCollection): Promise<QueryCreateCollectionResult>;
    execute(query: QueryDescribeCollection): Promise<QueryDescribeCollectionResult>;
    execute(query: QueryAlterCollection): Promise<QueryAlterCollectionResult>;
    execute(query: QueryCollectionExists): Promise<QueryCollectionExistsResult>;
    execute(query: QueryDropCollection): Promise<QueryDropCollectionResult>;
    execute(query: QueryShowCollection): Promise<QueryShowCollectionResult>;
    compareTypes(aType: ColumnType, aSize: number, bType: ColumnType, bSize: number): Compare;
    private executeSQL;
    private executeSelect;
    private executeAggregate;
    private executeUnion;
    private executeInsert;
    private executeUpdate;
    private executeDelete;
    private executeShowCollection;
    private executeDescribeCollection;
    private executeCreateCollection;
    private static tmpId;
    private executeAlterCollection;
    private executeCollectionExists;
    private executeDropCollection;
}
export declare type Statement = {
    sql: string;
    params: any[];
};
export declare function convertQueryToSQL(query: Query, variables?: Variables): Statement[];
