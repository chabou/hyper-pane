# hyper-pane
[![CI Status](https://circleci.com/gh/chabou/hyper-pane.svg?style=shield)](https://circleci.com/gh/chabou/hyper-pane)
[![NPM version](https://badge.fury.io/js/hyper-pane.svg)](https://www.npmjs.com/package/hyper-pane)
![Downloads](https://img.shields.io/npm/dm/hyper-pane.svg?style=flat)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

Extension for Hyper.app to enhance pane navigation. Navigate through panes with arrows, jump directly to a specific pane with digit, change focus on mouse hover or temporarily maximize a pane.

Navigation with arrows:
![hyper-pane](https://cloud.githubusercontent.com/assets/4137761/22717106/844a9c5c-ed99-11e6-8e88-8c71a8cbbd5a.gif)


Maximize pane:  
![hyper-pane-maximize](https://cloud.githubusercontent.com/assets/4137761/24831980/a0f2e86a-1ca5-11e7-80f5-f6a986863546.gif)

Inspired by https://github.com/iamstarkov/hyper-panes-iterm2-hotkeys

## Install

To install, execute:
```
hyper i hyper-pane
```

Or edit `~/.hyper.js` manually and add `"hyper-pane"` to `plugins`:

```
plugins: [
  "hyper-pane",
],
```

## Configuration

### Default configuration:
``` js
module.exports = {
  config: {
    // other configs...
    paneNavigation: {
      debug: false,
      hotkeys: {
        navigation: {
          up: 'ctrl+alt+up',
          down: 'ctrl+alt+down',
          left: 'ctrl+alt+left',
          right: 'ctrl+alt+right'
        },
        jump_prefix: 'ctrl+alt', // completed with 1-9 digits
        permutation_modifier: 'shift', // Added to jump and navigation hotkeys for pane permutation
        maximize: 'meta+enter'
      },
      showIndicators: true, // Show pane number
      indicatorPrefix: '^⌥', // Will be completed with pane number
      indicatorStyle: { // Added to indicator <div>
        position: 'absolute',
        top: 0,
        left: 0,
        fontSize: '10px'
      },
      focusOnMouseHover: false,
      inactivePaneOpacity: 0.6 // Set to 1 to disable inactive panes dimming
    }
  }
  //...
};
```
### Supported keys
For modifier keys you can use `shift`, `ctrl`, `alt`, or `meta`. You can substitute `option` for `alt` and `command` for `meta`.

Other special keys are `backspace`, `tab`, `enter`, `return`, `capslock`, `esc`, `escape`, `space`, `pageup`, `pagedown`, `end`, `home`, `left`, `up`, `right`, `down`, `ins`, `del`, and `plus`.

Any other key you should be able to reference by name like `a`, `/`, `$`, `*`, or `=`.

**⚠ Warning**: Use `ctrl+alt` or `cmd+alt` modifier only with arrow and digit key. Otherwise, shortcut will not be detected by Hyper.

## Usage
### Navigation with arrows

Use `ctrl+alt+<Up,Down,Left,Right>` (or your configured hotkeys) to navigate to a neighbor pane.

### Jump with digit

Use `ctrl+alt+<1-9>` (or your configured hotkeys) to jump directly to a numbered pane.
Panes are ordered "first child descendent" and `9` is reserved to the last pane.

Hotkey indicators are displayed on top left corner of each pane from 2 panes opened.
You can change its content, its style or hide them completly.

### Pane permutation

Adding `shift` key (or your configured key) to previous hotkeys cause a pane switching.

### Focus on mouse hover

Set `config.paneNavigation.focusOnMouseHover` to `true` and focus will change when mouse cursor enters into an another pane.

### Maximize a pane

You can temporarily maximize pane with `meta+enter` (or your configured key) and restore it with the same key.
You can have one maximized pane per tab.

### Dim inactive panes

By default, inactive panes are dimmed (opacity: 0.6).
You can disable this by setting `inactivePaneOpacity` to `1`.

