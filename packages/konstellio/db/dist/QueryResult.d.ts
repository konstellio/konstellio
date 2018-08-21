import * as Query from './Query';
export declare class QueryResult {
}
export declare class QuerySelectResult<T> extends QueryResult {
    readonly results: T[];
    constructor(results: T[]);
}
export declare class QueryAggregateResult<T> extends QueryResult {
    readonly results: T[];
    constructor(results: T[]);
}
export declare class QueryInsertResult extends QueryResult {
    readonly id: string;
    constructor(id: string);
}
export declare class QueryUpdateResult<T> extends QueryResult {
    readonly data: T;
    constructor(data: T);
}
export declare class QueryDeleteResult extends QueryResult {
    readonly acknowledge: boolean;
    constructor(acknowledge: boolean);
}
export declare class QueryCreateCollectionResult extends QueryResult {
    readonly acknowledge: boolean;
    constructor(acknowledge: boolean);
}
export declare class QueryAlterCollectionResult extends QueryResult {
    readonly acknowledge: boolean;
    constructor(acknowledge: boolean);
}
export declare class QueryShowCollectionResult extends QueryResult {
    readonly collections: Query.Collection[];
    constructor(collections: Query.Collection[]);
}
export declare class QueryDescribeCollectionResult extends QueryResult {
    readonly collection: Query.Collection;
    readonly columns: Query.Column[];
    readonly indexes: Query.Index[];
    constructor(collection: Query.Collection, columns: Query.Column[], indexes: Query.Index[]);
}
export declare class QueryCollectionExistsResult extends QueryResult {
    readonly exists: boolean;
    constructor(exists: boolean);
}
export declare class QueryDropCollectionResult extends QueryResult {
    readonly acknowledge: boolean;
    constructor(acknowledge: boolean);
}
