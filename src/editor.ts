import * as vscode from 'vscode';
import { getNonce } from './util';

export class RMMapEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new RMMapEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(RMMapEditorProvider.viewType, provider);
    return providerRegistration;
  }

  private static readonly viewType = 'rpgmaker.mapEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Called when our custom editor is opened.
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true
    };
    webviewPanel.webview.html = await this.buildHtmlForWebview(webviewPanel.webview, document);

    function updateWebview() {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText()
      });
    }

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    //
    // Remember that a single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    // Create cursor status bar
    const cursorStatusBarItem = vscode.window.createStatusBarItem(
      'rpgmaker.mapEditor.cursorStatusBar',
      vscode.StatusBarAlignment.Right,
      100
    );
    this.context.subscriptions.push(cursorStatusBarItem);

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      cursorStatusBarItem.dispose();
    });

    // Receive message from the webview.
    webviewPanel.webview.onDidReceiveMessage((e) => {
      switch (e.type) {
        case 'setCursorPos':
          this.setCursorPos(cursorStatusBarItem, e.x, e.y);
          return;
      }
    });

    updateWebview();
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private async buildHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): Promise<string> {
    const webviewUri = vscode.Uri.joinPath(this.context.extensionUri, 'map-editor', 'dist');

    if (!vscode.workspace.workspaceFolders) {
      return '';
    }
    const textDecoder = new TextDecoder();

    const dataFolderUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'data');
    const imgFolderUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'img', 'tilesets');

    const tilesetsJson = JSON.parse(
      textDecoder.decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dataFolderUri, 'Tilesets.json')))
    );
    const mapJson = JSON.parse(document.getText());
    const tileset = tilesetsJson[mapJson.tilesetId];
    const tilesetUris = tileset.tilesetNames.map((value: string) =>
      value ? `${webview.asWebviewUri(vscode.Uri.joinPath(imgFolderUri, `${value}.png`))}` : ''
    );

    const tilesetsUri = webview.asWebviewUri(vscode.Uri.joinPath(dataFolderUri, 'Tilesets.json'));
    const mapUri = webview.asWebviewUri(document.uri);

    const config = {
      tilesets: `${tilesetsUri}`,
      map: `${mapUri}`,
      tilesetNames: tilesetUris
    };

    const content = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(webviewUri, 'index.html'));
    let html = textDecoder.decode(content);
    html = html.replace('"{{excalidraw-asset-path}}"', `'${JSON.stringify(config)}'`);

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return this.fixLinks(html, webviewUri, webview);
  }

  private fixLinks(document: string, documentUri: vscode.Uri, webview: vscode.Webview): string {
    return document.replace(
      new RegExp('((?:src|href)=[\'"])(.*?)([\'"])', 'gmi'),
      (subString: string, p1: string, p2: string, p3: string): string => {
        const lower = p2.toLowerCase();
        if (p2.startsWith('#') || lower.startsWith('http://') || lower.startsWith('https://')) {
          return subString;
        }
        const newUri = vscode.Uri.joinPath(documentUri, p2);
        const newUrl = [p1, webview.asWebviewUri(newUri), p3].join('');
        return newUrl;
      }
    );
  }

  private setCursorPos(cursorStatusBarItem: vscode.StatusBarItem, x: number, y: number) {
    cursorStatusBarItem.text = `x:${x}, y:${y}`;
    cursorStatusBarItem.show();
  }

  /**
   * Try to get a current document as json text.
   */
  private getDocumentAsJson(document: vscode.TextDocument): any {
    const text = document.getText();
    if (text.trim().length === 0) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Could not get document as json. Content is not valid json');
    }
  }

  /**
   * Write out the json to a given document.
   */
  private updateTextDocument(document: vscode.TextDocument, json: any) {
    const edit = new vscode.WorkspaceEdit();

    // Just replace the entire document every time for this example extension.
    // A more complete extension should compute minimal edits instead.
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), JSON.stringify(json, null, 2));

    return vscode.workspace.applyEdit(edit);
  }
}
