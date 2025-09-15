# RPG Maker MV/MZ VSCode tools

## Installation
```bash
code --install-extension ./rpgmaker-tools-0.0.1.vsix
```

## Usage
- Open the project folder.
- Open a map file whose path is `data/MapXXX.json`.
  - Note: the map editor will not show if the path is not of the format above.
- Use VSCode command `View: Reopen Editor with ...`, and select `RM Map Editor`


## Known issues

- Shadow does not work.
  - Current `@pixi/tilemap` does not support `-1` tileset number for black texture.
- Some maps look weird, especially large maps
  - GPU has limitation on texture sizes. Should only paint visible tiles.
  

## Development

Debug build:
- First go to `map-editor` and `yarn build`.
- Use the VSCode launch command to start a debug instance.

Pack:
```bash
cd map-editor && yarn build && cd ..
vsce package
```
