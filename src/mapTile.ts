import * as vscode from 'vscode';
import { getNonce } from './util';
import { Blackboard } from './blackboard';

export class ColorsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'rpgmaker.mapTile';

  private _view?: vscode.WebviewView;

  public static register(context: vscode.ExtensionContext, blackboard: Blackboard): vscode.Disposable {
    const provider = new ColorsViewProvider(context.extensionUri, blackboard);
    const providerRegistration = vscode.window.registerWebviewViewProvider(ColorsViewProvider.viewType, provider);
    return providerRegistration;
  }

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly blackboard: Blackboard
  ) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri]
    };

    const refresh = async () => {
      webviewView.webview.html = await this.buildHtmlForWebview(webviewView.webview);
    };
    await refresh();
    this.blackboard.on('activeMapNameChange', refresh);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'colorSelected': {
          vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
          break;
        }
      }
    });

    // Make sure we get rid of the listener when our editor is closed.
    webviewView.onDidDispose(() => {
      this.blackboard.removeListener('activeMapNameChange', refresh);
    });
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private async buildHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const webviewUri = vscode.Uri.joinPath(this._extensionUri, 'map-tile', 'dist');

    if (!vscode.workspace.workspaceFolders || !this.blackboard.activeMapName) {
      return '';
    }
    const textDecoder = new TextDecoder();

    const dataFolderUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'data');
    const imgFolderUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'img', 'tilesets');

    const tilesetsJson = JSON.parse(
      textDecoder.decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dataFolderUri, 'Tilesets.json')))
    );
    const mapJson = JSON.parse(
      textDecoder.decode(
        await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dataFolderUri, this.blackboard.activeMapName))
      )
    );
    const tileset = tilesetsJson[mapJson.tilesetId];
    const tilesetUris = tileset.tilesetNames.map((value: string) =>
      value ? `${webview.asWebviewUri(vscode.Uri.joinPath(imgFolderUri, `${value}.png`))}` : ''
    );

    const tilesetsUri = webview.asWebviewUri(vscode.Uri.joinPath(dataFolderUri, 'Tilesets.json'));
    const mapUri = webview.asWebviewUri(vscode.Uri.joinPath(dataFolderUri, this.blackboard.activeMapName));

    const config = {
      tilesets: `${tilesetsUri}`,
      map: `${mapUri}`,
      tilesetNames: tilesetUris
    };

    const content = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(webviewUri, 'index.html'));
    let html = textDecoder.decode(content);
    html = html.replace('"{{rpgmaker-asset-path}}"', `'${JSON.stringify(config)}'`);

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
}
