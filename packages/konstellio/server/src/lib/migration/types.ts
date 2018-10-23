import { IndexType, ColumnType, Compare } from "@konstellio/db";

export interface Schema {
	collections: Collection[];
}

export interface Collection {
	handle: string;
	indexes: Index[];
	fields: Field[];
}

export interface IndexField {
	field: string;
	direction?: 'asc' | 'desc';
}

export interface Index {
	handle: string;
	type: IndexType;
	fields: IndexField[];
}

export interface Field {
	handle: string;
	type: ColumnType;
	size?: number;
}

export type SchemaDiff = SchemaDiffAddCollection | SchemaDiffRenameCollection | SchemaDiffDropCollection | SchemaDiffAddField | SchemaDiffDropField | SchemaDiffAlterField | SchemaDiffAddIndex | SchemaDiffAlterIndex | SchemaDiffDropIndex;

export type SchemaDiffAddCollection = {
	action: 'add_collection'
	collection: Collection
	sourceSchema: Schema
	renamedTo?: string
};

export type SchemaDiffRenameCollection = {
	action: 'rename_collection'
	collection: Collection
	renamedFrom: string
};

export type SchemaDiffDropCollection = {
	action: 'drop_collection'
	collection: Collection
};

export type SchemaDiffAddField = {
	action: 'add_field'
	collection: Collection
	field: Field
	sourceCollection: Collection
	renamedTo?: string
};

export type SchemaDiffDropField = {
	action: 'drop_field'
	collection: Collection
	field: Field
};

export type SchemaDiffAlterField = {
	action: 'alter_field'
	collection: Collection
	field: Field
	sourceCollection: Collection
};

export type SchemaDiffAddIndex = {
	action: 'add_index'
	collection: Collection
	index: Index
};

export type SchemaDiffAlterIndex = {
	action: 'alter_index'
	collection: Collection
	index: Index
};

export type SchemaDiffDropIndex = {
	action: 'drop_index'
	collection: Collection
	index: Index
};

export type compareTypes = (aType: ColumnType, aSize: number, bType: ColumnType, bSize: number) => Compare;