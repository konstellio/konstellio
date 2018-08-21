"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class QueryResult {
}
exports.QueryResult = QueryResult;
class QuerySelectResult extends QueryResult {
    constructor(results) {
        super();
        this.results = results;
    }
}
exports.QuerySelectResult = QuerySelectResult;
class QueryAggregateResult extends QueryResult {
    constructor(results) {
        super();
        this.results = results;
    }
}
exports.QueryAggregateResult = QueryAggregateResult;
class QueryInsertResult extends QueryResult {
    constructor(id) {
        super();
        this.id = id;
    }
}
exports.QueryInsertResult = QueryInsertResult;
class QueryUpdateResult extends QueryResult {
    constructor(data) {
        super();
        this.data = data;
    }
}
exports.QueryUpdateResult = QueryUpdateResult;
class QueryDeleteResult extends QueryResult {
    constructor(acknowledge) {
        super();
        this.acknowledge = acknowledge;
    }
}
exports.QueryDeleteResult = QueryDeleteResult;
class QueryCreateCollectionResult extends QueryResult {
    constructor(acknowledge) {
        super();
        this.acknowledge = acknowledge;
    }
}
exports.QueryCreateCollectionResult = QueryCreateCollectionResult;
class QueryAlterCollectionResult extends QueryResult {
    constructor(acknowledge) {
        super();
        this.acknowledge = acknowledge;
    }
}
exports.QueryAlterCollectionResult = QueryAlterCollectionResult;
class QueryShowCollectionResult extends QueryResult {
    constructor(collections) {
        super();
        this.collections = collections;
    }
}
exports.QueryShowCollectionResult = QueryShowCollectionResult;
class QueryDescribeCollectionResult extends QueryResult {
    constructor(collection, columns, indexes) {
        super();
        this.collection = collection;
        this.columns = columns;
        this.indexes = indexes;
    }
}
exports.QueryDescribeCollectionResult = QueryDescribeCollectionResult;
class QueryCollectionExistsResult extends QueryResult {
    constructor(exists) {
        super();
        this.exists = exists;
    }
}
exports.QueryCollectionExistsResult = QueryCollectionExistsResult;
class QueryDropCollectionResult extends QueryResult {
    constructor(acknowledge) {
        super();
        this.acknowledge = acknowledge;
    }
}
exports.QueryDropCollectionResult = QueryDropCollectionResult;
//# sourceMappingURL=QueryResult.js.map