import * as PIXI from 'pixi.js';
import { requireRpgMaker, ShaderTilemap, type AssetPaths, type MapData } from './rmmv';

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

async function setupView() {
  const assetData = JSON.parse((window as any).ASSET_PATHS) as AssetPaths;
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
    preference: 'webgl'
  });
}

async function setupGame() {
  const assetData = JSON.parse((window as any).ASSET_PATHS) as AssetPaths;
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

  _app.ticker.add(update);
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
  await setupView();
  await setupGame();
  (globalThis as any).pixiapp = _app;
};
