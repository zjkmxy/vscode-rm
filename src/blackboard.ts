import { EventEmitter } from 'eventemitter3';

export class Blackboard extends EventEmitter {
  private _activeMapName: string = '';

  public get activeMapName() {
    return this._activeMapName;
  }

  public set activeMapName(value: string) {
    this._activeMapName = value;
    this.emit('activeMapNameChange');
  }
}
