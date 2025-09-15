import * as vscode from 'vscode';
import { RMMapEditorProvider } from './editor';

export function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  context.subscriptions.push(RMMapEditorProvider.register(context));
}
