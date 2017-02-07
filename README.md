# hyper-pane
Extension for Hyper.app to enhance pane navigation.

![hyper-pane](https://cloud.githubusercontent.com/assets/4137761/22717106/844a9c5c-ed99-11e6-8e88-8c71a8cbbd5a.gif)

Inspired by https://github.com/iamstarkov/hyper-panes-iterm2-hotkeys

## Install

To install, edit `~/.hyper.js` and add `"hyper-pane"` to `plugins`:

```
plugins: [
  "hyper-pane",
],
```

## Usage
### Navigation with arrows

You can use `Ctrl+Alt+<Up,Down,Left,Right>` to navigate to a neighbor pane.

### Navigation with digit

You can use `Ctrl+Alt+<1-9>` to jump to a numbered pane.
Panes are ordered "first child descendent" but `9` is reserved to the last pane.

Shortcuts are displayed on top left corner of each pane from 2 panes opened.

### Switching/Moving pane

Adding `Shift` key to previous shortcuts cause a pane switching.

