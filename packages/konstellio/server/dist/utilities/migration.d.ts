/// <reference types="node" />
import { DocumentNode } from "graphql";
import { Driver, ColumnType, IndexType, Compare } from "@konstellio/db";
import { WriteStream, ReadStream } from 'tty';
import { Locales } from "./config";
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
export declare type SchemaDiff = SchemaDiffAddCollection | SchemaDiffRenameCollection | SchemaDiffDropCollection | SchemaDiffAddField | SchemaDiffDropField | SchemaDiffAlterField | SchemaDiffAddIndex | SchemaDiffAlterIndex | SchemaDiffDropIndex;
export declare type SchemaDiffAddCollection = {
    action: 'add_collection';
    collection: Collection;
    sourceSchema: Schema;
    renamedTo?: string;
};
export declare type SchemaDiffRenameCollection = {
    action: 'rename_collection';
    collection: Collection;
    renamedFrom: string;
};
export declare type SchemaDiffDropCollection = {
    action: 'drop_collection';
    collection: Collection;
};
export declare type SchemaDiffAddField = {
    action: 'add_field';
    collection: Collection;
    field: Field;
    sourceCollection: Collection;
    renamedTo?: string;
};
export declare type SchemaDiffDropField = {
    action: 'drop_field';
    collection: Collection;
    field: Field;
};
export declare type SchemaDiffAlterField = {
    action: 'alter_field';
    collection: Collection;
    field: Field;
    sourceCollection: Collection;
};
export declare type SchemaDiffAddIndex = {
    action: 'add_index';
    collection: Collection;
    index: Index;
};
export declare type SchemaDiffAlterIndex = {
    action: 'alter_index';
    collection: Collection;
    index: Index;
};
export declare type SchemaDiffDropIndex = {
    action: 'drop_index';
    collection: Collection;
    index: Index;
};
/**
 * Create Schema from DocumentNode
 */
export declare function createSchemaFromDefinitions(ast: DocumentNode, locales: Locales): Promise<Schema>;
/**
 * Create Schema from Database
 */
export declare function createSchemaFromDatabase(database: Driver, locales: Locales): Promise<Schema>;
export declare type compareTypes = (aType: ColumnType, aSize: number, bType: ColumnType, bSize: number) => Compare;
/**
 * Compute schema differences
 */
export declare function computeSchemaDiff(source: Schema, target: Schema, compareTypes: compareTypes): SchemaDiff[];
/**
 * Prompt user for migration diffs
 */
export declare function promptSchemaDiffs(stdin: ReadStream, stdout: WriteStream, diffs: SchemaDiff[], compareTypes: compareTypes): Promise<SchemaDiff[]>;
/**
 * Execute schema diff
 */
export declare function executeSchemaDiff(diffs: SchemaDiff[], database: Driver): Promise<void>;
