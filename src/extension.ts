import * as vscode from 'vscode';
import { RMMapEditorProvider } from './editor';
import { ColorsViewProvider } from './mapTile';
import { Blackboard } from './blackboard';

export function activate(context: vscode.ExtensionContext) {
  const blackboard = new Blackboard();

  // Register our custom editor providers
  context.subscriptions.push(ColorsViewProvider.register(context, blackboard));
  context.subscriptions.push(RMMapEditorProvider.register(context, blackboard));
}
