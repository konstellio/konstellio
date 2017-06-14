import { ADriver } from './Driver';
import {
	SelectQueryResult,
	AggregateQueryResult,
	InsertQueryResult,
	UpdateQueryResult,
	ReplaceQueryResult,
	DeleteQueryResult
} from './QueryResult';
import {
	q,
	Expression,
	Bitwise,
	Comparison,
	SelectQuery,
	UnionQuery,
	AggregateQuery,
	InsertQuery,
	UpdateQuery,
	ReplaceQuery,
	DeleteQuery,
	TooComplexQueryError,
	QueryNotSupportedError,
	QuerySyntaxError,
	simplifyBitwiseTree
} from './Query';
import * as SQLite from 'sqlite3';
import { List } from 'immutable';

// https://github.com/mapbox/node-sqlite3