import * as vscode from 'vscode';
import { RMMapEditorProvider } from './editor';
import { ColorsViewProvider } from './mapTile';

export function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  context.subscriptions.push(ColorsViewProvider.register(context));
  context.subscriptions.push(RMMapEditorProvider.register(context));
}
