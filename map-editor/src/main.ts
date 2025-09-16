import * as PIXI from 'pixi.js';
import { requireRpgMaker, ShaderTilemap, type AssetPaths, type MapData } from './rmmv';

const vscode = (globalThis as any).acquireVsCodeApi ? acquireVsCodeApi() : null;
const _app = new PIXI.Application();
const rpgMakerLoader = requireRpgMaker();
let stage: PIXI.Container;
let tilemap: ShaderTilemap;

// const scale = Number(getOptionValue('scale') || 1);
// const resolution = Number(getOptionValue('resolution') || window.devicePixelRatio);
// const ratio = window.devicePixelRatio / resolution;
const scale = 1;
const resolution = window.devicePixelRatio;

function resizeTilemap() {
  if (!tilemap) return;
  tilemap.width = (_app.renderer.width + 2 * tilemap.margin) * scale;
  tilemap.height = (_app.renderer.height + 2 * tilemap.margin) * scale;
  stage.scale.x = 1.0 / scale;
  stage.scale.y = 1.0 / scale;
  stage.filterArea = new PIXI.Rectangle(0, 0, _app.renderer.width * scale, _app.renderer.height * scale);
}

// function resize(width: number, height: number) {
//   const backCanvas = document.querySelector('#backCanvas') as HTMLCanvasElement;
//   backCanvas.style.width = `${width}px`;
//   backCanvas.style.height = `${height}px`;
//   _app.renderer.resize(width, height);
//   resizeTilemap();
// }

let assetPaths: string = '';

async function setupView() {
  const assetData = JSON.parse(assetPaths) as AssetPaths;
  const mapData = (await PIXI.Assets.load(assetData.map)) as MapData;
  const [width, height] = [mapData.width * 48, mapData.height * 48];

  const backCanvas = document.querySelector('#backCanvas') as HTMLCanvasElement;
  backCanvas.style.width = `${width}px`;
  backCanvas.style.height = `${height}px`;

  await _app.init({
    // width: backCanvas.width,
    // height: backCanvas.height,
    width,
    height,
    canvas: backCanvas,
    resolution,
    antialias: true,
    preference: 'webgl' // webgpu has size issue
  });
}

let mapPoint = new PIXI.Point();

async function setupGame() {
  const assetData = JSON.parse(assetPaths) as AssetPaths;
  const mapData = (await PIXI.Assets.load(assetData.map)) as MapData;
  const map = await rpgMakerLoader.load(mapData, assetData, true);

  tilemap = map;
  tilemap.roundPixels = scale === 1;
  tilemap.origin = { x: 0, y: 0 };
  stage = new PIXI.Container();
  stage.addChild(tilemap);
  _app.stage = stage;

  resizeTilemap();
  // resize(mapData.width * 48, mapData.height * 48);

  // Create the select rect for TEMP use
  const selectRect = _app.stage.addChild(
    new PIXI.Graphics()
      .rect(0, 0, 48, 48)
      .fill({ color: 0xffffff, alpha: 0.4 })
      .stroke({ color: 0x111111, alpha: 0.9, width: 1 })
  );

  _app.ticker.add(update);

  // Follow the pointer
  _app.stage.eventMode = 'static';
  _app.stage.hitArea = _app.screen;
  _app.stage.addEventListener('pointermove', (e) => {
    const newPos = new PIXI.Point(Math.floor(e.globalX / 48.0), Math.floor(e.globalY / 48.0));
    if (!newPos.equals(mapPoint)) {
      mapPoint.copyFrom(newPos);
      // Move the cursor
      selectRect.position.set(mapPoint.x * 48.0, mapPoint.y * 48.0);
      // Post message
      vscode?.postMessage({
        type: 'setCursorPos',
        x: mapPoint.x,
        y: mapPoint.y,
      })
    }
  });
}

let initRefreshed = false;

function update(ticker: PIXI.Ticker) {
  const dt = ticker.deltaMS / 1000;

  if (stage) {
    tilemap.updateDelta(dt);
    if (!initRefreshed) {
      tilemap.origin = { x: 1, y: 1 };
      tilemap.refresh();
      tilemap.origin = { x: 0, y: 0 };
      tilemap.refresh();
      initRefreshed = true;
    }
  }
}

(globalThis as any).go = async () => {
  assetPaths = (window as any).ASSET_PATHS;
  // Patch for dev
  if (assetPaths === '{{excalidraw-asset-path}}') {
    assetPaths = `{"tilesets":"rpgmaker/data/Tilesets.json",
        "map":"rpgmaker/data/Map003.json",
        "tilesetNames":[
          "rpgmaker/img/tilesets/Outside_A1.png",
          "rpgmaker/img/tilesets/Outside_A2.png",
          "rpgmaker/img/tilesets/Outside_A3.png",
          "rpgmaker/img/tilesets/Outside_A4.png",
          "rpgmaker/img/tilesets/Outside_A5.png",
          "rpgmaker/img/tilesets/Outside_B.png",
          "rpgmaker/img/tilesets/Outside_C.png",
          "",
          ""]}`;
  }
  await setupView();
  await setupGame();
  (globalThis as any).pixiapp = _app;
};
