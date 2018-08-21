import { ObjectTypeDefinitionNode, UnionTypeDefinitionNode, DocumentNode, DefinitionNode } from "graphql";
import { Locales } from "./utilities/config";
import { Driver, Field, FieldAs, BinaryExpression, FieldDirection } from "@konstellio/db";
import { Schema as JoiSchema } from "joi";
import { IResolvers } from "graphql-tools";
import { Schema as DataSchema } from "./utilities/migration";
export declare type CollectionType = {
    id: string;
    [field: string]: any;
};
export declare class Collection<I, O extends CollectionType> {
    readonly driver: Driver;
    readonly locales: Locales;
    static createTypeExtension(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): string;
    static createResolvers(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): IResolvers;
    readonly name: string;
    private readonly collection;
    private readonly defaultLocale;
    private readonly validation;
    private readonly loader;
    private readonly fields;
    private readonly fieldMap;
    constructor(driver: Driver, locales: Locales, ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode);
    findById(id: string, { locale, fields }: {
        locale?: string;
        fields?: (string | Field)[];
    }): Promise<O>;
    findByIds(ids: string[], { locale, fields }: {
        locale?: string;
        fields?: (string | Field)[];
    }): Promise<O[]>;
    findOne(options: {
        locale?: string;
        fields?: (Field | FieldAs)[];
        condition?: BinaryExpression;
        sort?: FieldDirection[];
        offset?: number;
    }): Promise<O>;
    find(options: {
        locale?: string;
        fields?: (Field | FieldAs)[];
        condition?: BinaryExpression;
        sort?: FieldDirection[];
        offset?: number;
        limit?: number;
    }): Promise<O[]>;
    aggregate<T>(options: {
        locale?: string;
        fields?: (Field | FieldAs)[];
        condition?: BinaryExpression;
        group?: (Field | Function)[];
        sort?: FieldDirection[];
        offset?: number;
        limit?: number;
    }): Promise<T[]>;
    create(data: I): Promise<string>;
    replace(data: I): Promise<boolean>;
    delete(ids: string[]): Promise<boolean>;
    validate(data: any, errors?: Error[]): data is I;
}
export declare class Structure<I, O extends CollectionType> extends Collection<I, O> {
    static createTypeExtension(ast: DocumentNode, node: ObjectTypeDefinitionNode | UnionTypeDefinitionNode): string;
}
export declare class Single<I, O extends CollectionType> extends Collection<I, O> {
}
export declare function createCollections(driver: Driver, schema: DataSchema, ast: DocumentNode, locales: Locales): Collection<any, any>[];
/**
 * Create type extension for each collections
 */
export declare function createTypeExtensionsFromDefinitions(ast: DocumentNode, locales: Locales): string;
/**
 * Create Joi Schema from Definitions
 */
export declare function createValidationSchemaFromDefinition(ast: DocumentNode, node: DefinitionNode, locales: Locales): JoiSchema;
/**
 * Build input definitions for each collections
 */
export declare function createInputTypeFromDefinitions(ast: DocumentNode, locales: Locales): DocumentNode;
export declare function createTypeExtensionsFromDatabaseDriver(driver: Driver, locales: Locales): string;
