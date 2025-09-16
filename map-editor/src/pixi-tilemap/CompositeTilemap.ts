import { BufferImageSource, Container, type PointData, Texture } from 'pixi.js';
import { Tilemap } from './Tilemap';

/**
 * A tilemap composite that lazily builds tilesets layered into multiple tilemaps.
 *
 * The composite tileset is the concatenation of the individual tilesets used in the tilemaps. You can
 * preinitialized it by passing a list of tile textures to the constructor. Otherwise, the composite tilemap
 * is lazily built as you add more tiles with newer tile textures. A new tilemap is created once the last
 * tilemap has reached its limit (as set by {@link CompositeTilemap.texturesPerTilemap texturesPerTilemap}).
 *
 * @example
 * import { Application } from '@pixi/app';
 * import { CompositeTilemap } from '@pixi/tilemap';
 * import { Loader } from '@pixi/loaders';
 *
 * // Setup view & stage.
 * const app = new Application();
 *
 * document.body.appendChild(app.renderer.view);
 * app.stage.interactive = true;
 *
 * // Global reference to the tilemap.
 * let globalTilemap: CompositeTilemap;
 *
 * // Load the tileset spritesheet!
 * Loader.shared.load('atlas.json');
 *
 * // Initialize the tilemap scene when the assets load.
 * Loader.shared.load(function onTilesetLoaded()
 * {
 *      const tilemap = new CompositeTilemap();
 *
 *      // Setup the game level with grass and dungeons!
 *      for (let x = 0; x < 10; x++)
 *      {
 *          for (let y = 0; y < 10; y++)
 *          {
 *              tilemap.tile(
 *                  x % 2 === 0 && (x === y || x + y === 10) ? 'dungeon.png' : 'grass.png',
 *                  x * 100,
 *                  y * 100,
 *              );
 *          }
 *      }
 *
 *      globalTilemap = app.stage.addChild(tilemap);
 * });
 *
 * // Show a bomb at a random location whenever the user clicks!
 * app.stage.on('click', function onClick()
 * {
 *      if (!globalTilemap) return;
 *
 *      const x = Math.floor(Math.random() * 10);
 *      const y = Math.floor(Math.random() * 10);
 *
 *      globalTilemap.tile('bomb.png', x * 100, y * 100);
 * });
 */
export class CompositeTilemap extends Container {
  /** The hard limit on the number of tile textures used in each tilemap. */
  public static readonly texturesPerTilemap: number = 1;

  // For shadow
  private static shadowTexture = new Texture({
    source: new BufferImageSource({
      resource: new Uint8Array([0, 0, 0, 127]),
      width: 1,
      height: 1,
      alphaMode: 'premultiply-alpha-on-upload'
    }),
    label: 'SHADOW'
  });

  private shadowId = -1;

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
      for (const child of this.children) {
        (child as Tilemap)?.setTileAnim?.(value);
      }
    }
  }

  /**
   * @param tileset - A list of tile base-textures that will be used to eagerly initialized the layered
   *  tilemaps. This is only an performance optimization, and using {@link CompositeTilemap.tile tile}
   *  will work equivalently.
   */
  constructor(tileset?: Array<Texture>) {
    super();

    this.tileset(tileset);
  }

  /**
   * This will preinitialize the tilesets of the layered tilemaps.
   *
   * If used after a tilemap has been created (or a tile added), this will overwrite the tile textures of the
   * existing tilemaps. Passing the tileset to the constructor instead is the best practice.
   *
   * @param tileTextures - The list of tile textures that make up the tileset.
   */
  tileset(tileTextures?: Array<Texture | undefined>): this {
    if (!tileTextures) {
      tileTextures = [];
    }

    const len1 = this.children.length;
    const len2 = Math.ceil(tileTextures.length);

    for (let i = 0; i < Math.min(len1, len2); i++) {
      if ((this.children[i] as Tilemap).baseTexture.source !== tileTextures[i]?.source) {
        throw new Error('Dynamically assign texture to a Tilemap is not implemented.');
      }
    }
    for (let i = len1; i < len2; i++) {
      const tilemap = new Tilemap(tileTextures[i] ?? new Texture());

      // TODO: Don't use children
      this.addChild(tilemap);
    }

    return this;
  }

  /** Clears the tilemap composite. */
  clear(): this {
    for (let i = 0; i < this.children.length; i++) {
      (this.children[i] as Tilemap).clear();
    }

    return this;
  }

  /**
   * Adds a tile that paints the given tile texture at (x, y).
   *
   * @param tileTexture - The tile texture. You can pass an index into the composite tilemap as well.
   * @param x - The local x-coordinate of the tile's location.
   * @param y - The local y-coordinate of the tile's location.
   * @param options - Additional options to pass to {@link Tilemap.tile}.
   * @param [options.u=texture.frame.x] - The x-coordinate of the texture in its base-texture's space.
   * @param [options.v=texture.frame.y] - The y-coordinate of the texture in its base-texture's space.
   * @param [options.tileWidth=texture.orig.width] - The local width of the tile.
   * @param [options.tileHeight=texture.orig.height] - The local height of the tile.
   * @param [options.animX=0] - For animated tiles, this is the "offset" along the x-axis for adjacent
   *      animation frame textures in the base-texture.
   * @param [options.animY=0] - For animated tiles, this is the "offset" along the y-axis for adjacent
   *      animation frames textures in the base-texture.
   * @param [options.rotate=0]
   * @param [options.animCountX=1024] - For animated tiles, this is the number of animation frame textures
   *      per row.
   * @param [options.animCountY=1024] - For animated tiles, this is the number of animation frame textures
   *      per column.
   * @param [options.animDivisor=1] - For animated tiles, this is the animation duration each frame
   * @return This tilemap, good for chaining.
   */
  tile(
    tileTexture: Texture | string | number,
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
    } = {}
  ): this {
    let tilemap: Tilemap | undefined;
    const children = this.children;

    if (tileTexture === -1) {
      // Shadow
      if (this.shadowId === -1) {
        // Create a new tilemap initialized with the shadow texture.
        tilemap = new Tilemap(CompositeTilemap.shadowTexture);

        this.addChild(tilemap);
        this.shadowId = this.children.length - 1;
      } else {
        tilemap = children[this.shadowId] as Tilemap;
      }

      tilemap.tile(undefined, x, y, options);
    } else if (typeof tileTexture === 'number') {
      const childIndex = tileTexture;

      tilemap = children[childIndex] as Tilemap;

      if (!tilemap) {
        tilemap = children[0] as Tilemap;

        // Silently fail if the tilemap doesn't exist
        if (!tilemap) return this;
      }

      tilemap.tile(undefined, x, y, options);
    } else {
      if (typeof tileTexture === 'string') {
        tileTexture = Texture.from(tileTexture);
      }

      // Probe all tilemaps to find which tileset contains the base-texture.
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as Tilemap;

        if (child.baseTexture.source === tileTexture.source) {
          tilemap = child;
          break;
        }
      }

      // If no tileset contains the base-texture, attempt to add it.
      if (!tilemap) {
        // Create a new tilemap initialized with that tile texture.
        tilemap = new Tilemap(tileTexture);

        this.addChild(tilemap);
      }

      tilemap.tile(tileTexture, x, y, options);
    }

    return this;
  }
}