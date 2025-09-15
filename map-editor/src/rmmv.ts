import * as PIXI from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';

/**
 * Returns a modulo value which is always positive.
 *
 * @method Number.prototype.mod
 * @param {Number} n The divisor
 * @return {Number} A modulo value
 */
export const numberMod = (v: number, n: number): number => ((v % n) + n) % n;
export const DefaultFps = 60;

// -----------------------------------------------------------------------------
/**
 * The root object of the display tree.
 */
export class Stage extends PIXI.Container implements Disposable {
  constructor() {
    super();

    // The interactive flag causes a memory leak.
    this.interactive = false;
  }

  /** The frame-based update. Approximately 60 FPS. */
  public update() {
    this.updateChildren();
  }

  /** The frame-independent update. Approximately 60 FPS. */
  public updateDelta(delta: number) {
    this.updateChildrenDelta(delta);
  }

  /**
   * Update the children of the scene EACH frame.
   */
  public updateChildren() {
    for (const child of this.children) {
      if (child instanceof Stage && child.update) {
        child.update();
      }
    }
  }

  /**
   * Update the children of the scene frame-independently.
   */
  public updateChildrenDelta(delta: number) {
    for (const child of this.children) {
      if (child instanceof Stage && child.updateDelta) {
        child.updateDelta(delta);
      }
    }
  }

  [Symbol.dispose](): void {
    this.destroy({ children: true });
  }
}

//-----------------------------------------------------------------------------
export class CounterInterpolator {
  protected _current: number;
  protected _cumulated: number;

  public readonly bound;
  public readonly start;
  public readonly inteval;

  constructor(bound: number, start: number = 0, inteval: number = 1.0 / DefaultFps) {
    this.bound = bound;
    this.start = start;
    this.inteval = inteval;
    this._current = start;
    this._cumulated = 0;
  }

  get value(): number {
    return this._current;
  }

  get done(): boolean {
    return false;
  }

  public updateDelta(delta: number): number {
    this._cumulated += delta;
    if (this._cumulated >= this.inteval) {
      const cnt = Math.floor(this._cumulated / this.inteval);
      this._current = (this._current + cnt) % this.bound;
      this._cumulated -= cnt * this.inteval;
    }
    return this._current;
  }
}

//-----------------------------------------------------------------------------
/**
 * The tilemap which displays 2D tile-based game map.
 */
export abstract class Tilemap extends Stage {
  protected _margin = 20;
  protected _tileWidth = 48;
  protected _tileHeight = 48;
  protected _mapWidth = 0;
  protected _mapHeight = 0;
  protected _mapData: Array<number> | undefined;
  protected _layerWidth = 0;
  protected _layerHeight = 0;

  /**
   * The bitmaps used as a tileset.
   */
  bitmaps: Array<PIXI.Texture | undefined> = [];

  /**
   * The origin point of the tilemap for scrolling.
   */
  _scrollOrigin = new PIXI.Point();

  get scrollOrigin(): PIXI.Point {
    return this._scrollOrigin;
  }

  set scrollOrigin(value: PIXI.PointData) {
    if (value.x !== this._scrollOrigin.x || value.y !== this._scrollOrigin.y) {
      this._scrollOrigin = new PIXI.Point(value.x, value.y);
      this._repaint(false);
    }
  }

  /**
   * The tileset flags.
   */
  flags = [];

  /**
   * The animation count for autotiles.
   */
  animationCount = new CounterInterpolator(12, 0, 30 / DefaultFps);

  /**
   * Whether the tilemap loops horizontal.
   */
  horizontalWrap = false;

  /**
   * Whether the tilemap loops vertical.
   */
  verticalWrap = false;

  public animationFrame = 0;

  protected _width: number;
  protected _height: number;

  constructor(width: number, height: number) {
    super();

    this._width = width + this._margin * 2;
    this._height = height + this._margin * 2;
  }

  protected abstract _createLayers(): void;

  protected abstract updateTileAnim(x: number, y: number): void;

  protected abstract _repaint(forceRepaint: boolean): void;

  /**
   * The width of the screen in pixels.
   */
  public get width() {
    return this._width;
  }

  public set width(value) {
    if (this._width !== value) {
      this._width = value;
      this._createLayers();
    }
  }

  /**
   * The height of the screen in pixels.
   */
  public get height() {
    return this._height;
  }

  public set height(value) {
    if (this._height !== value) {
      this._height = value;
      this._createLayers();
    }
  }

  /**
   * The width of a tile in pixels.
   */
  public get tileWidth() {
    return this._tileWidth;
  }

  public set tileWidth(value) {
    if (this._tileWidth !== value) {
      this._tileWidth = value;
      this._createLayers();
    }
  }

  /**
   * The height of a tile in pixels.
   */
  public get tileHeight() {
    return this._tileHeight;
  }

  public set tileHeight(value) {
    if (this._tileHeight !== value) {
      this._tileHeight = value;
      this._createLayers();
    }
  }

  public get margin() {
    return this._margin;
  }

  public get mapWidth() {
    return this._mapWidth;
  }

  public get mapHeight() {
    return this._mapHeight;
  }

  /**
   * Sets the tilemap data.
   */
  public setData(width: number, height: number, data: Array<number>) {
    this._mapWidth = width;
    this._mapHeight = height;
    this._mapData = data;
  }

  /**
   * Updates the tilemap for each frame.
   */
  public override updateDelta(delta: number) {
    this.animationCount.updateDelta(delta);

    this.animationFrame = this.animationCount.value;

    let af = this.animationFrame % 4;

    if (af === 3) af = 1;

    this.updateTileAnim(af * this._tileWidth, (this.animationFrame % 3) * this._tileHeight);
  }

  public _tempLowerTiles = [];
  public _tempUpperTiles = [];

  protected _readMapData(x: number, y: number, z: number): number {
    if (this._mapData) {
      const width = this._mapWidth;
      const height = this._mapHeight;

      if (this.horizontalWrap) {
        x = numberMod(x, width);
      }
      if (this.verticalWrap) {
        y = numberMod(y, height);
      }
      if (x >= 0 && x < width && y >= 0 && y < height) {
        return this._mapData[(z * height + y) * width + x] ?? 0;
      }

      return 0;
    }

    return 0;
  }

  protected _isHigherTile(tileId: number): boolean {
    return !!(this.flags[tileId] & 0x10);
  }

  protected _isTableTile(tileId: number): boolean {
    return !!(Tilemap.isTileA2(tileId) && this.flags[tileId] & 0x80);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _isOverpassPosition(_mx: number, _my: number): boolean {
    return false;
  }

  // Tile type checkers

  public static TILE_ID_B = 0;
  public static TILE_ID_C = 256;
  public static TILE_ID_D = 512;
  public static TILE_ID_E = 768;
  public static TILE_ID_A5 = 1536;
  public static TILE_ID_A1 = 2048;
  public static TILE_ID_A2 = 2816;
  public static TILE_ID_A3 = 4352;
  public static TILE_ID_A4 = 5888;
  public static TILE_ID_MAX = 8192;

  public static isVisibleTile(tileId: number) {
    return tileId > 0 && tileId < this.TILE_ID_MAX;
  }

  public static isAutotile(tileId: number) {
    return tileId >= this.TILE_ID_A1;
  }

  public static getAutotileKind(tileId: number) {
    return Math.floor((tileId - this.TILE_ID_A1) / 48);
  }

  public static getAutotileShape(tileId: number) {
    return (tileId - this.TILE_ID_A1) % 48;
  }

  public static makeAutotileId(kind: number, shape: number) {
    return this.TILE_ID_A1 + kind * 48 + shape;
  }

  public static isSameKindTile(tileID1: number, tileID2: number) {
    if (this.isAutotile(tileID1) && this.isAutotile(tileID2)) {
      return this.getAutotileKind(tileID1) === this.getAutotileKind(tileID2);
    }

    return tileID1 === tileID2;
  }

  public static isTileA1(tileId: number) {
    return tileId >= this.TILE_ID_A1 && tileId < this.TILE_ID_A2;
  }

  public static isTileA2(tileId: number) {
    return tileId >= this.TILE_ID_A2 && tileId < this.TILE_ID_A3;
  }

  public static isTileA3(tileId: number) {
    return tileId >= this.TILE_ID_A3 && tileId < this.TILE_ID_A4;
  }

  public static isTileA4(tileId: number) {
    return tileId >= this.TILE_ID_A4 && tileId < this.TILE_ID_MAX;
  }

  public static isTileA5(tileId: number) {
    return tileId >= this.TILE_ID_A5 && tileId < this.TILE_ID_A1;
  }

  public static isWaterTile(tileId: number) {
    if (this.isTileA1(tileId)) {
      return !(tileId >= this.TILE_ID_A1 + 96 && tileId < this.TILE_ID_A1 + 192);
    }

    return false;
  }

  public static isWaterfallTile(tileId: number) {
    if (tileId >= this.TILE_ID_A1 + 192 && tileId < this.TILE_ID_A2) {
      return this.getAutotileKind(tileId) % 2 === 1;
    }

    return false;
  }

  public static isGroundTile(tileId: number) {
    return this.isTileA1(tileId) || this.isTileA2(tileId) || this.isTileA5(tileId);
  }

  public static isShadowingTile(tileId: number) {
    return this.isTileA3(tileId) || this.isTileA4(tileId);
  }

  public static isRoofTile(tileId: number) {
    return this.isTileA3(tileId) && this.getAutotileKind(tileId) % 16 < 8;
  }

  public static isWallTopTile(tileId: number) {
    return this.isTileA4(tileId) && this.getAutotileKind(tileId) % 16 < 8;
  }

  public static isWallSideTile(tileId: number) {
    return (this.isTileA3(tileId) || this.isTileA4(tileId)) && this.getAutotileKind(tileId) % 16 >= 8;
  }

  public static isWallTile(tileId: number) {
    return this.isWallTopTile(tileId) || this.isWallSideTile(tileId);
  }

  public static isFloorTypeAutotile(tileId: number) {
    return (
      (this.isTileA1(tileId) && !this.isWaterfallTile(tileId)) || this.isTileA2(tileId) || this.isWallTopTile(tileId)
    );
  }

  public static isWallTypeAutotile(tileId: number) {
    return this.isRoofTile(tileId) || this.isWallSideTile(tileId);
  }

  public static isWaterfallTypeAutotile(tileId: number) {
    return this.isWaterfallTile(tileId);
  }

  // Autotile shape number to coordinates of tileset images
  // prettier-ignore
  public static readonly FLOOR_AUTOTILE_TABLE = [
    [[2, 4], [1, 4], [2, 3], [1, 3]], [[2, 0], [1, 4], [2, 3], [1, 3]],
    [[2, 4], [3, 0], [2, 3], [1, 3]], [[2, 0], [3, 0], [2, 3], [1, 3]],
    [[2, 4], [1, 4], [2, 3], [3, 1]], [[2, 0], [1, 4], [2, 3], [3, 1]],
    [[2, 4], [3, 0], [2, 3], [3, 1]], [[2, 0], [3, 0], [2, 3], [3, 1]],
    [[2, 4], [1, 4], [2, 1], [1, 3]], [[2, 0], [1, 4], [2, 1], [1, 3]],
    [[2, 4], [3, 0], [2, 1], [1, 3]], [[2, 0], [3, 0], [2, 1], [1, 3]],
    [[2, 4], [1, 4], [2, 1], [3, 1]], [[2, 0], [1, 4], [2, 1], [3, 1]],
    [[2, 4], [3, 0], [2, 1], [3, 1]], [[2, 0], [3, 0], [2, 1], [3, 1]],
    [[0, 4], [1, 4], [0, 3], [1, 3]], [[0, 4], [3, 0], [0, 3], [1, 3]],
    [[0, 4], [1, 4], [0, 3], [3, 1]], [[0, 4], [3, 0], [0, 3], [3, 1]],
    [[2, 2], [1, 2], [2, 3], [1, 3]], [[2, 2], [1, 2], [2, 3], [3, 1]],
    [[2, 2], [1, 2], [2, 1], [1, 3]], [[2, 2], [1, 2], [2, 1], [3, 1]],
    [[2, 4], [3, 4], [2, 3], [3, 3]], [[2, 4], [3, 4], [2, 1], [3, 3]],
    [[2, 0], [3, 4], [2, 3], [3, 3]], [[2, 0], [3, 4], [2, 1], [3, 3]],
    [[2, 4], [1, 4], [2, 5], [1, 5]], [[2, 0], [1, 4], [2, 5], [1, 5]],
    [[2, 4], [3, 0], [2, 5], [1, 5]], [[2, 0], [3, 0], [2, 5], [1, 5]],
    [[0, 4], [3, 4], [0, 3], [3, 3]], [[2, 2], [1, 2], [2, 5], [1, 5]],
    [[0, 2], [1, 2], [0, 3], [1, 3]], [[0, 2], [1, 2], [0, 3], [3, 1]],
    [[2, 2], [3, 2], [2, 3], [3, 3]], [[2, 2], [3, 2], [2, 1], [3, 3]],
    [[2, 4], [3, 4], [2, 5], [3, 5]], [[2, 0], [3, 4], [2, 5], [3, 5]],
    [[0, 4], [1, 4], [0, 5], [1, 5]], [[0, 4], [3, 0], [0, 5], [1, 5]],
    [[0, 2], [3, 2], [0, 3], [3, 3]], [[0, 2], [1, 2], [0, 5], [1, 5]],
    [[0, 4], [3, 4], [0, 5], [3, 5]], [[2, 2], [3, 2], [2, 5], [3, 5]],
    [[0, 2], [3, 2], [0, 5], [3, 5]], [[0, 0], [1, 0], [0, 1], [1, 1]]
  ];

  // prettier-ignore
  public static readonly WALL_AUTOTILE_TABLE = [
    [[2, 2], [1, 2], [2, 1], [1, 1]], [[0, 2], [1, 2], [0, 1], [1, 1]],
    [[2, 0], [1, 0], [2, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[2, 2], [3, 2], [2, 1], [3, 1]], [[0, 2], [3, 2], [0, 1], [3, 1]],
    [[2, 0], [3, 0], [2, 1], [3, 1]], [[0, 0], [3, 0], [0, 1], [3, 1]],
    [[2, 2], [1, 2], [2, 3], [1, 3]], [[0, 2], [1, 2], [0, 3], [1, 3]],
    [[2, 0], [1, 0], [2, 3], [1, 3]], [[0, 0], [1, 0], [0, 3], [1, 3]],
    [[2, 2], [3, 2], [2, 3], [3, 3]], [[0, 2], [3, 2], [0, 3], [3, 3]],
    [[2, 0], [3, 0], [2, 3], [3, 3]], [[0, 0], [3, 0], [0, 3], [3, 3]]
  ];

  // prettier-ignore
  public static readonly WATERFALL_AUTOTILE_TABLE = [
    [[2, 0], [1, 0], [2, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[2, 0], [3, 0], [2, 1], [3, 1]], [[0, 0], [3, 0], [0, 1], [3, 1]]
  ];
}

/*
 * Z coordinate:
 *
 * 0 : Lower tiles
 * 1 : Lower characters
 * 3 : Normal characters
 * 4 : Upper tiles
 * 5 : Upper characters
 * 6 : Airship shadow
 * 7 : Balloon
 * 8 : Animation
 * 9 : Destination
 */

//-----------------------------------------------------------------------------
/**
 * The tilemap which displays 2D tile-based game map using shaders
 */
export class ShaderTilemap extends Tilemap {
  roundPixels = false;
  protected _lastBitmapLength = -1;
  // protected _needsRepaint = false;
  protected _lastStartX: number | undefined;
  protected _lastStartY: number | undefined;

  public lowerLayer: CompositeTilemap[];
  public upperLayer: CompositeTilemap[];
  public shadowLayer: CompositeTilemap;

  /** Whether to paint the whole map at once */
  public readonly paintAll;

  constructor(width: number, height: number, paintAll = false) {
    super(width, height);
    this.paintAll = paintAll;

    // @hackerham: create layers only in initialization. Doesn't depend on width/height
    // Adapted from old _createLayers
    this.lowerLayer = Array.from({ length: 4 }, () => new CompositeTilemap());
    this.addChild(this.lowerLayer[0], this.lowerLayer[1]);
    this.shadowLayer = new CompositeTilemap();
    this.addChild(this.shadowLayer);
    this.addChild(this.lowerLayer[2], this.lowerLayer[3]);
    this.upperLayer = Array.from({ length: 4 }, () => new CompositeTilemap());
    this.addChild(...this.upperLayer);

    this._createLayers();

    this.refresh();
  }

  /**
   * Forces to repaint the entire tilemap AND update bitmaps list if needed
   */
  public refresh() {
    if (this._lastBitmapLength !== this.bitmaps.length) {
      this._lastBitmapLength = this.bitmaps.length;
      this._updateBitmaps();
    }
    // this._needsRepaint = true;
    this._repaint(true);
  }

  /**
   * Updates bitmaps list
   */
  protected _updateBitmaps() {
    // const bitmaps = this.bitmaps;
    // this.lowerLayer.tileset(bitmaps);
    // this.upperLayer.tileset(bitmaps);
    const bitmaps = this.bitmaps.flatMap((value) => (value ? value.source : []));
    for (const layer of this.lowerLayer) {
      layer.tileset(bitmaps);
    }
    for (const layer of this.upperLayer) {
      layer.tileset(bitmaps);
    }
  }

  public override _repaint(force: boolean) {
    let ox: number;
    let oy: number;

    if (this.roundPixels) {
      ox = Math.floor(this.origin.x);
      oy = Math.floor(this.origin.y);
    } else {
      ox = this.origin.x;
      oy = this.origin.y;
    }
    if (this.paintAll) {
      this._updateLayerPositions(0, 0);
      if (force) {
        this._paintAllTiles(0, 0);
      }
    } else {
      const startX = Math.floor((ox - this._margin) / this._tileWidth);
      const startY = Math.floor((oy - this._margin) / this._tileHeight);

      this._updateLayerPositions(startX, startY);
      if (force || this._lastStartX !== startX || this._lastStartY !== startY) {
        this._lastStartX = startX;
        this._lastStartY = startY;
        this._paintAllTiles(startX, startY);
      }
    }
  }

  protected override updateTileAnim(x: number, y: number) {
    for (const layer of this.lowerLayer) {
      layer.tileAnim = [x, y];
    }
    for (const layer of this.upperLayer) {
      layer.tileAnim = [x, y];
    }
  }

  protected override _createLayers() {
    this._repaint(true);
  }

  protected _updateLayerPositions(startX: number, startY: number) {
    let ox: number;
    let oy: number;

    if (this.roundPixels) {
      ox = Math.floor(this.origin.x);
      oy = Math.floor(this.origin.y);
    } else {
      ox = this.origin.x;
      oy = this.origin.y;
    }
    for (const layer of this.lowerLayer) {
      layer.position = {
        x: startX * this._tileWidth - ox,
        y: startY * this._tileHeight - oy
      };
    }
    for (const layer of this.upperLayer) {
      layer.position = {
        x: startX * this._tileWidth - ox,
        y: startY * this._tileHeight - oy
      };
    }
    this.shadowLayer.position = {
      x: startX * this._tileWidth - ox,
      y: startY * this._tileHeight - oy
    };
  }

  protected _paintAllTiles(startX: number, startY: number) {
    for (const layer of this.lowerLayer) {
      layer.clear();
    }
    for (const layer of this.upperLayer) {
      layer.clear();
    }
    this.shadowLayer.clear();

    if (this.paintAll) {
      for (let y = 0; y < this._mapHeight; y++) {
        for (let x = 0; x < this._mapWidth; x++) {
          this._paintTiles(0, 0, x, y);
        }
      }
    } else {
      const tileCols = Math.ceil(this._width / this._tileWidth) + 1;
      const tileRows = Math.ceil(this._height / this._tileHeight) + 1;

      for (let y = 0; y < tileRows; y++) {
        for (let x = 0; x < tileCols; x++) {
          this._paintTiles(startX, startY, x, y);
        }
      }
    }
  }

  protected _paintTiles(startX: number, startY: number, x: number, y: number) {
    if (!this.lowerLayer || !this.upperLayer) {
      return;
    }
    const mx = startX + x;
    const my = startY + y;
    const dx = x * this._tileWidth;
    const dy = y * this._tileHeight;
    const tileId0 = this._readMapData(mx, my, 0);
    const tileId1 = this._readMapData(mx, my, 1);
    const tileId2 = this._readMapData(mx, my, 2);
    const tileId3 = this._readMapData(mx, my, 3);
    const shadowBits = this._readMapData(mx, my, 4);
    const upperTileId1 = this._readMapData(mx, my - 1, 1);
    const lowerLayer = this.lowerLayer;
    const upperLayer = this.upperLayer;

    if (this._isHigherTile(tileId0)) {
      this._drawTile(upperLayer[0], tileId0, dx, dy);
    } else {
      this._drawTile(lowerLayer[0], tileId0, dx, dy);
    }
    if (this._isHigherTile(tileId1)) {
      this._drawTile(upperLayer[1], tileId1, dx, dy);
    } else {
      this._drawTile(lowerLayer[1], tileId1, dx, dy);
    }

    this._drawShadow(this.shadowLayer, shadowBits, dx, dy);
    if (this._isTableTile(upperTileId1) && !this._isTableTile(tileId1)) {
      if (!Tilemap.isShadowingTile(tileId0)) {
        this._drawTableEdge(lowerLayer[2], upperTileId1, dx, dy);
      }
    }

    if (this._isOverpassPosition(mx, my)) {
      this._drawTile(upperLayer[2], tileId2, dx, dy);
      this._drawTile(upperLayer[3], tileId3, dx, dy);
    } else {
      if (this._isHigherTile(tileId2)) {
        this._drawTile(upperLayer[2], tileId2, dx, dy);
      } else {
        this._drawTile(lowerLayer[2], tileId2, dx, dy);
      }
      if (this._isHigherTile(tileId3)) {
        this._drawTile(upperLayer[3], tileId3, dx, dy);
      } else {
        this._drawTile(lowerLayer[3], tileId3, dx, dy);
      }
    }
  }

  protected _drawTile(layer: CompositeTilemap, tileId: number, dx: number, dy: number) {
    if (Tilemap.isVisibleTile(tileId)) {
      if (Tilemap.isAutotile(tileId)) {
        this._drawAutotile(layer, tileId, dx, dy);
      } else {
        this._drawNormalTile(layer, tileId, dx, dy);
      }
    }
  }

  protected _drawNormalTile(layer: CompositeTilemap, tileId: number, dx: number, dy: number) {
    let setNumber = 0;

    if (Tilemap.isTileA5(tileId)) {
      setNumber = 4;
    } else {
      setNumber = 5 + Math.floor(tileId / 256);
    }

    const w = this._tileWidth;
    const h = this._tileHeight;
    const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * w;
    const sy = (Math.floor((tileId % 256) / 8) % 16) * h;

    layer.tile(setNumber, dx, dy, {
      u: sx,
      v: sy,
      tileWidth: w,
      tileHeight: h
    });
  }

  protected _drawAutotile(layer: CompositeTilemap, tileId: number, dx: number, dy: number) {
    let autotileTable = Tilemap.FLOOR_AUTOTILE_TABLE;
    const kind = Tilemap.getAutotileKind(tileId);
    const shape = Tilemap.getAutotileShape(tileId);
    const tx = kind % 8;
    const ty = Math.floor(kind / 8);
    let bx = 0;
    let by = 0;
    let setNumber = 0;
    let isTable = false;
    let animX = 0;
    let animY = 0;

    if (Tilemap.isTileA1(tileId)) {
      setNumber = 0;
      if (kind === 0) {
        animX = 2;
        by = 0;
      } else if (kind === 1) {
        animX = 2;
        by = 3;
      } else if (kind === 2) {
        bx = 6;
        by = 0;
      } else if (kind === 3) {
        bx = 6;
        by = 3;
      } else {
        bx = Math.floor(tx / 4) * 8;
        by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
        if (kind % 2 === 0) {
          animX = 2;
        } else {
          bx += 6;
          autotileTable = Tilemap.WATERFALL_AUTOTILE_TABLE;
          animY = 1;
        }
      }
    } else if (Tilemap.isTileA2(tileId)) {
      setNumber = 1;
      bx = tx * 2;
      by = (ty - 2) * 3;
      isTable = this._isTableTile(tileId);
    } else if (Tilemap.isTileA3(tileId)) {
      setNumber = 2;
      bx = tx * 2;
      by = (ty - 6) * 2;
      autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
    } else if (Tilemap.isTileA4(tileId)) {
      setNumber = 3;
      bx = tx * 2;
      by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
      if (ty % 2 === 1) {
        autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
      }
    }

    const table = autotileTable[shape];
    const w1 = this._tileWidth / 2;
    const h1 = this._tileHeight / 2;

    for (let i = 0; i < 4; i++) {
      const qsx = table[i][0];
      const qsy = table[i][1];
      const sx1 = (bx * 2 + qsx) * w1;
      const sy1 = (by * 2 + qsy) * h1;
      const dx1 = dx + (i % 2) * w1;
      const dy1 = dy + Math.floor(i / 2) * h1;

      if (isTable && (qsy === 1 || qsy === 5)) {
        let qsx2 = qsx;
        const qsy2 = 3;

        if (qsy === 1) {
          // qsx2 = [0, 3, 2, 1][qsx];
          qsx2 = (4 - qsx) % 4;
        }
        const sx2 = (bx * 2 + qsx2) * w1;
        const sy2 = (by * 2 + qsy2) * h1;

        layer.tile(setNumber, dx1, dy1, {
          u: sx2,
          v: sy2,
          tileWidth: w1,
          tileHeight: h1,
          animX,
          animY
        });
        layer.tile(setNumber, dx1, dy1 + h1 / 2, {
          u: sx1,
          v: sy1,
          tileWidth: w1,
          tileHeight: h1 / 2,
          animX,
          animY
        });
      } else {
        layer.tile(setNumber, dx1, dy1, {
          u: sx1,
          v: sy1,
          tileWidth: w1,
          tileHeight: h1,
          animX,
          animY
        });
      }
    }
  }

  protected _drawTableEdge(layer: CompositeTilemap, tileId: number, dx: number, dy: number) {
    if (Tilemap.isTileA2(tileId)) {
      const autotileTable = Tilemap.FLOOR_AUTOTILE_TABLE;
      const kind = Tilemap.getAutotileKind(tileId);
      const shape = Tilemap.getAutotileShape(tileId);
      const tx = kind % 8;
      const ty = Math.floor(kind / 8);
      const setNumber = 1;
      const bx = tx * 2;
      const by = (ty - 2) * 3;
      const table = autotileTable[shape];
      const w1 = this._tileWidth / 2;
      const h1 = this._tileHeight / 2;

      for (let i = 0; i < 2; i++) {
        const qsx = table[2 + i][0];
        const qsy = table[2 + i][1];
        const sx1 = (bx * 2 + qsx) * w1;
        const sy1 = (by * 2 + qsy) * h1 + h1 / 2;
        const dx1 = dx + (i % 2) * w1;
        const dy1 = dy + Math.floor(i / 2) * h1;

        layer.tile(setNumber, dx1, dy1, {
          u: sx1,
          v: sy1,
          tileWidth: w1,
          tileHeight: h1 / 2
        });
      }
    }
  }

  protected _drawShadow(layer: CompositeTilemap, shadowBits: number, dx: number, dy: number) {
    if (shadowBits & 0x0f) {
      const w1 = this._tileWidth / 2;
      const h1 = this._tileHeight / 2;

      for (let i = 0; i < 4; i++) {
        if (shadowBits & (1 << i)) {
          const dx1 = dx + (i % 2) * w1;
          const dy1 = dy + Math.floor(i / 2) * h1;

          layer.tile(-1, dx1, dy1, {
            tileWidth: w1,
            tileHeight: h1
          });
        }
      }
    }
  }
}

//-----------------------------------------------------------------------------
export type MapData = {
  tilesetId: number;
  width: number;
  height: number;
  data: number[];
};

export type AssetPaths = {
  tilesets: string;
  map: string;
  tilesetNames: string[];
};

class LevelLoader {
  async load(map: MapData, assetPaths: AssetPaths, paintAll = false) {
    PIXI.Assets.add({ alias: 'tilesets', src: assetPaths.tilesets });
    const tilesets = await PIXI.Assets.load('tilesets');
    const tilesetFlags = tilesets[map.tilesetId].flags;
    const tileResources: Record<string, PIXI.Texture | undefined> = {};

    for (const tileName of assetPaths.tilesetNames) {
      if (tileName.length > 0) {
        tileResources[tileName] = await PIXI.Assets.load(tileName);
      }
    }
    const result = new ShaderTilemap(map.width * 48, map.height * 48, paintAll);

    for (const tileName of assetPaths.tilesetNames) {
      const tex = tileResources[tileName];

      result.bitmaps.push(tex);
    }
    while (result.bitmaps.length > 0 && !result.bitmaps[result.bitmaps.length - 1]) {
      result.bitmaps.pop();
    }
    result.flags = tilesetFlags;
    result.setData(map.width, map.height, map.data);
    result.refresh();

    return result;
  }
}

export function requireRpgMaker() {
  return new LevelLoader();
}
