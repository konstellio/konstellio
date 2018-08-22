'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileSystemProvider } from './FileSystemProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const provider = new FileSystemProvider();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftp', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('ftps', provider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('sftp', provider, { isCaseSensitive: true }));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.downloadSelected', async (uri: vscode.Uri, selections: vscode.Uri[]) => {
	// 	const destinations = await vscode.window.showOpenDialog({
	// 		canSelectFiles: false,
	// 		canSelectFolders: true,
	// 		canSelectMany: false,
	// 		openLabel: 'Download here'
	// 	});
	// 	if (destinations) {
	// 		console.log('Download', selections.map(s => s.toString(true)), destinations[0].fsPath);
	// 	}
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.uploadFilesHere', async (uri: vscode.Uri, selections: vscode.Uri[]) => {
	// 	const sources = await vscode.window.showOpenDialog({
	// 		canSelectFiles: true,
	// 		canSelectFolders: false,
	// 		canSelectMany: true,
	// 		openLabel: 'Upload'
	// 	});
	// 	if (sources) {
	// 		console.log('Upload', sources.map(s => s.fsPath), uri.toString(true));
	// 	}
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.uploadFoldersHere', async (uri: vscode.Uri, selections: vscode.Uri[]) => {
	// 	const sources = await vscode.window.showOpenDialog({
	// 		canSelectFiles: false,
	// 		canSelectFolders: true,
	// 		canSelectMany: true,
	// 		openLabel: 'Upload'
	// 	});
	// 	if (sources) {
	// 		console.log('Upload', sources.map(s => s.fsPath), uri.toString(true));
	// 	}
	// }));

	// let NEXT_TERM_ID = 1;
	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.createTerminal', () => {
	// 	const terminal = vscode.window.createTerminal(`Ext Terminal #${NEXT_TERM_ID++}`);
	// 	terminal.sendText("echo 'Sent text immediately after creating'");
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('konstelliofs.startTask', () => {
	// 	vscode.window.withProgress({
	// 		location: vscode.ProgressLocation.Notification,
	// 		title: "I am long running!",
	// 		cancellable: true
	// 	}, (progress, token) => {
	// 		token.onCancellationRequested(() => {
	// 			console.log("User canceled the long running operation")
	// 		});

	// 		progress.report({ increment: 0 });

	// 		setTimeout(() => {
	// 			progress.report({ increment: 10, message: "I am long running! - still going..." });
	// 		}, 1000);

	// 		setTimeout(() => {
	// 			progress.report({ increment: 40, message: "I am long running! - still going even more..." });
	// 		}, 2000);

	// 		setTimeout(() => {
	// 			progress.report({ increment: 50, message: "I am long running! - almost there..." });
	// 		}, 3000);

	// 		var p = new Promise(resolve => {
	// 			setTimeout(() => {
	// 				resolve();
	// 			}, 5000);
	// 		});

	// 		return p;
	// 	});
	// }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}