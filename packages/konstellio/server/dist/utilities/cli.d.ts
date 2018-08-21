/// <reference types="node" />
import { WriteStream, ReadStream } from 'tty';
/**
 * Prompt question to user and return answer
 */
export declare function promptQuestion(stdin: ReadStream, stdout: WriteStream, question: string): Promise<string>;
/**
 * Prompt selection to user and return answer
 */
export declare function promptSelection(stdin: ReadStream, stdout: WriteStream, question: string, selections: Map<string, string>): Promise<string>;
