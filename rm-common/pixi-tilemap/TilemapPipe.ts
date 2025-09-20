import { BatchableMesh, ExtensionType, InstructionSet, MeshGeometry, type Renderer, type RenderPipe } from 'pixi.js';
import { Tilemap } from './Tilemap';

interface RenderableData {
  canBatch: boolean;
  renderable: Tilemap;
  batchableMesh?: BatchableMesh;
  geometry?: MeshGeometry;
}

/**
 * The pipeline for rendering Tilemap.
 * Since we use Mesh, it does not need to implement execute() in InstructionPipe<Tilemap>.
 */
export class TilemapPipe implements RenderPipe<Tilemap> {
  /** @ignore */
  public static extension = {
    type: [ExtensionType.WebGLPipes, ExtensionType.WebGPUPipes],
    name: 'tilemap'
  } as const;

  private _renderer: Renderer;
  private readonly _tilemapDataHash: Record<number, RenderableData> = {};

  constructor(renderer: Renderer) {
    this._renderer = renderer;
  }

  private _getTilemapData(renderable: Tilemap): RenderableData {
    return this._tilemapDataHash[renderable.uid] || this._initTilemapData(renderable);
  }

  private _initTilemapData(tilemap: Tilemap): RenderableData {
    const geometry = tilemap._computeGeometriesBatched();

    this._tilemapDataHash[tilemap.uid] = {
      canBatch: true,
      renderable: tilemap,
      geometry
    };

    tilemap.on('destroyed', () => {
      this.destroyRenderable(tilemap);
    });

    return this._tilemapDataHash[tilemap.uid];
  }

  public destroy() {
    for (const i in this._tilemapDataHash) {
      this.destroyRenderable(this._tilemapDataHash[i].renderable);
    }

    (this._tilemapDataHash as unknown as null) = null;
    (this._renderer as unknown as null) = null;
  }

  public addRenderable(renderable: Tilemap, instructionSet: InstructionSet) {
    const batcher = this._renderer.renderPipes.batch;

    const tilemapData = this._getTilemapData(renderable);

    const { canBatch } = tilemapData;

    if (canBatch) {
      // Note: Should be an array of this.renderer.uid as MeshPipe does.
      tilemapData.batchableMesh ??= new BatchableMesh();

      const batchableMesh = tilemapData.batchableMesh;

      if (renderable._didTilemapUpdate) {
        renderable._didTilemapUpdate = false;

        const geometry = renderable._computeGeometriesBatched(tilemapData.geometry);

        batchableMesh.geometry = geometry;
        batchableMesh.renderable = renderable;
        batchableMesh.setTexture(renderable.baseTexture);
        batchableMesh.transform = renderable.groupTransform;
      }

      batchableMesh.roundPixels = (this._renderer._roundPixels | renderable._roundPixels) as 0 | 1;

      batcher.addToBatch(batchableMesh, instructionSet);
    } else {
      // batcher.break(instructionSet);
      // tilingSpriteData.shader ||= new TilingSpriteShader();
      // this.updateRenderable(tilingSprite);
      // instructionSet.add(tilingSprite);
      throw new Error('Tilemap should always be batchable for now.');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateRenderable(renderable: Tilemap, _instructionSet?: InstructionSet) {
    const tilemapData = this._getTilemapData(renderable);

    const { canBatch } = tilemapData;

    if (canBatch) {
      const { batchableMesh } = tilemapData;

      if (!batchableMesh) {
        throw new Error('Mesh must be ready when updated');
      }

      if (renderable._didTilemapUpdate) {
        const geometry = renderable._computeGeometriesBatched(tilemapData.geometry);

        batchableMesh.geometry = geometry;
        batchableMesh.setTexture(renderable.baseTexture);
      }

      batchableMesh._batcher.updateElement(batchableMesh);
    } else if (renderable._didTilemapUpdate) {
      // const { shader } = tilingSpriteData;
      // // now update uniforms...
      // shader.updateUniforms(
      //     tilingSprite.width,
      //     tilingSprite.height,
      //     tilingSprite._tileTransform.matrix,
      //     tilingSprite.anchor.x,
      //     tilingSprite.anchor.y,
      //     tilingSprite.texture,
      // );
    }

    renderable._didTilemapUpdate = false;
  }

  destroyRenderable(renderable: Tilemap) {
    const tilemapData = this._tilemapDataHash[renderable.uid];

    if (tilemapData) {
      tilemapData.batchableMesh = undefined;
    }

    delete this._tilemapDataHash[renderable.uid];
  }

  validateRenderable(renderable: Tilemap): boolean {
    // return true; // TODO: Has problems if return false

    const tilemapData = this._getTilemapData(renderable);
    const { batchableMesh } = tilemapData;

    if (renderable._didTilemapUpdate) {
      return true;
    }

    if (batchableMesh?.texture._source !== renderable.baseTexture._source) {
      return !batchableMesh?._batcher.checkAndUpdateTexture(batchableMesh, renderable.baseTexture);
    }

    // No need to rebuild
    return false;
  }
}
