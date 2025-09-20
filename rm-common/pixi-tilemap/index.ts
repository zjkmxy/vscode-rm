import { extensions } from 'pixi.js';
import { TilemapPipe } from './TilemapPipe';

export { CompositeTilemap } from './CompositeTilemap';
export { Tilemap } from './Tilemap';

extensions.add(TilemapPipe);
