import {
  Bounds,
  ViewContainer,
  type Instruction,
  MeshGeometry,
  type PointData,
  Texture,
  type View
} from 'pixi.js';

export type PointStruct = {
  u: number;
  v: number;
  x: number;
  y: number;
  tileWidth: number;
  tileHeight: number;
  /** rotate is not supported for now */
  rotate: number;
  animX: number;
  animY: number;
  // textureIndex: number;
  /** In RPG Maker the following 3 are always default: large, large, 1 */
  animCountX: number;
  animCountY: number;
  animDivisor: number;
  /** alpha is not supported for now */
  alpha: number;
};

/**
 * A rectangular tilemap implementation that renders a predefined set of tile textures.
 */
export class Tilemap extends ViewContainer implements View, Instruction {
  public readonly renderPipeId = 'tilemap';
  public readonly canBundle = true;
  public readonly batched = true;

  /** The geometry of the tilemap. */
  protected readonly pointsBuf: Array<PointStruct> = [];

  /** The only Texture of this tilemap */
  public readonly baseTexture: Texture;

  /**
   * The local bounds of the tilemap itself. This does not include DisplayObject children.
   */
  protected readonly tilemapBounds = new Bounds();

  /** Flags whether any animated tile was added. */
  protected hasAnimatedTile = false;

  /** @internal */
  public _didTilemapUpdate = true;

  /**
   * The tile animation frame.
   *
   * @see CompositeTilemap.tileAnim
   */
  protected tileAnim: PointData = { x: 0, y: 0 };

  public getTileAnim() {
    return this.tileAnim;
  }

  public setTileAnim(value: PointData) {
    if (this.tileAnim.x !== value.x || this.tileAnim.y !== value.y) {
      this.tileAnim = value;
      // Tell the pipe to rebuild the geometry
      if (this.hasAnimatedTile) {
        this.onTilemapUpdate();
      }
    }
  }

  protected updateBounds() {
    this._bounds.minX = this.tilemapBounds.minX;
    this._bounds.maxX = this.tilemapBounds.maxX;

    this._bounds.minY = this.tilemapBounds.minY;
    this._bounds.maxY = this.tilemapBounds.maxY;

    // Note: this thing does not have a user-defined width and height.
  }

  _roundPixels: 0 | 1 = 0;
  get roundPixels(): boolean {
    return this._roundPixels === 1;
  }
  set roundPixels(value: boolean) {
    this._roundPixels = value ? 1 : 0;
  }

  /**  Clears all the tiles added into this tilemap. */
  clear(): this {
    this.pointsBuf.length = 0;
    // this._didTilemapUpdate = true;
    this.tilemapBounds.clear();
    this.hasAnimatedTile = false;
    this.onTilemapUpdate();

    return this;
  }

  /**
   * @param tileset - The tileset to use for the tilemap. This can be reset later with {@link Tilemap.setTileset}. The
   *      base-textures in this array must not be duplicated.
   * @note Only baseTexture.source makes sense.
   */
  constructor(baseTexture: Texture) {
    super({});
    this.baseTexture = baseTexture;
  }

  tile(
    texture: Texture | undefined,
    x: number,
    y: number,
    options: {
      u?: number;
      v?: number;
      tileWidth?: number;
      tileHeight?: number;
      animX?: number;
      animY?: number;
      rotate?: number;
      animCountX?: number;
      animCountY?: number;
      animDivisor?: number;
      alpha?: number;
    } = {}
  ): this {
    // assert texture.source === this.baseTexture
    texture ??= this.baseTexture;

    options.u = options.u || texture.frame.x;
    options.v = options.v || texture.frame.y;
    options.tileWidth = options.tileWidth || texture.orig.width;
    options.tileHeight = options.tileHeight || texture.orig.height;

    const {
      u = 0,
      v = 0,
      tileWidth = texture.width,
      tileHeight = texture.height,
      animX = 0,
      animY = 0,
      rotate = 0,
      animCountX = 1024,
      animCountY = 1024,
      animDivisor = 1,
      alpha = 1
    } = options;

    const pb = this.pointsBuf;

    this.hasAnimatedTile = this.hasAnimatedTile || animX > 0 || animY > 0;

    pb.push({
      u,
      v,
      x,
      y,
      tileWidth,
      tileHeight,
      rotate,
      animX: animX | 0,
      animY: animY | 0,
      animCountX,
      animCountY,
      animDivisor,
      alpha
    });

    this.tilemapBounds.addFrame(x, y, x + tileWidth, y + tileHeight);

    this.onTilemapUpdate();

    return this;
  }

  // passed local space..
  public containsPoint(point: PointData) {
    const bounds = this._bounds;

    if (point.x >= bounds.maxX && point.x <= bounds.minX) {
      if (point.y >= bounds.maxY && point.y <= bounds.minY) {
        return true;
      }
    }

    return false;
  }

  public addBounds(bounds: Bounds) {
    const _bounds = this.bounds;

    bounds.addFrame(_bounds.minX, _bounds.minY, _bounds.maxX, _bounds.maxY);
  }

  public _computeGeometriesBatched(geometry?: MeshGeometry) {
    // Assert geometries.length === this.tilesets.length
    if (!geometry || geometry.positions.length <= this.pointsBuf.length * 8) {
      // TODO: Pool this array
      geometry = new MeshGeometry({
        positions: new Float32Array(this.pointsBuf.length * 8),
        uvs: new Float32Array(this.pointsBuf.length * 8),
        indices: new Uint32Array(this.pointsBuf.length * 6)
      });
    } else if (geometry.positions.length >= this.pointsBuf.length * 8) {
      geometry.positions = geometry.positions.subarray(0, this.pointsBuf.length * 8);
      geometry.uvs = geometry.uvs.subarray(0, this.pointsBuf.length * 8);
      geometry.indices = geometry.indices.subarray(0, this.pointsBuf.length * 6);
    }

    const positions = geometry.positions;
    const uvs = geometry.uvs;
    const indices = geometry.indices;

    for (const [i, point] of this.pointsBuf.entries()) {
      const pntBase = i * 4;
      const base = pntBase * 2;
      const indBase = i * 6;

      // In the original version, there are 7 shader variables
      // attribute vec2 aVertexPosition;
      // attribute vec2 aTextureCoord;
      // attribute vec4 aFrame;
      // attribute vec2 aAnim;
      // attribute float aAnimDivisor;
      // attribute float aTextureId;
      // attribute float aAlpha;
      // Among them, aFrame seems not important.
      // aAnim and aAnimDivisor are used to compute animOffset, applied to vTextureCoord.
      // aAlpha seems to be handled by the container.

      // animOffset
      const currentFrame = [
        Math.floor(this.tileAnim.x / point.animDivisor + 0.5),
        Math.floor(this.tileAnim.y / point.animDivisor + 0.5)
      ];
      const animOffset = [
        point.animX ? point.animX * (currentFrame[0] % point.animCountX) : 0,
        point.animY ? point.animY * (currentFrame[1] % point.animCountY) : 0
      ];

      // aVertexPosition
      positions[base + 0] = point.x;
      positions[base + 1] = point.y;
      positions[base + 2] = point.x + point.tileWidth;
      positions[base + 3] = point.y;
      positions[base + 4] = point.x + point.tileWidth;
      positions[base + 5] = point.y + point.tileHeight;
      positions[base + 6] = point.x;
      positions[base + 7] = point.y + point.tileHeight;

      // vTextureCoord
      const [u, v] = [point.u + animOffset[0], point.v + animOffset[1]];

      uvs[base + 0] = u / this.baseTexture.source.width;
      uvs[base + 1] = v / this.baseTexture.source.height;
      uvs[base + 2] = (u + point.tileWidth) / this.baseTexture.source.width;
      uvs[base + 3] = v / this.baseTexture.source.height;
      uvs[base + 4] = (u + point.tileWidth) / this.baseTexture.source.width;
      uvs[base + 5] = (v + point.tileHeight) / this.baseTexture.source.height;
      uvs[base + 6] = u / this.baseTexture.source.width;
      uvs[base + 7] = (v + point.tileHeight) / this.baseTexture.source.height;

      // indices
      indices[indBase + 0] = pntBase;
      indices[indBase + 1] = pntBase + 1;
      indices[indBase + 2] = pntBase + 2;
      indices[indBase + 3] = pntBase;
      indices[indBase + 4] = pntBase + 2;
      indices[indBase + 5] = pntBase + 3;
    }

    return geometry;
  }

  /**
   * @internal
   */
  public onTilemapUpdate() {
    this._boundsDirty = true;
    this._didTilemapUpdate = true;

    this._didChangeId += 1 << 12;

    if (this.didViewUpdate) return;
    this.didViewUpdate = true;

    if (this.renderGroup) {
      this.renderGroup.onChildViewUpdate(this);
    }
  }
}
