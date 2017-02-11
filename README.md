# hyper-pane
Extension for Hyper.app to enhance pane navigation. Navigate through panes with arrows or jump directly to a specific pane with digit.

![hyper-pane](https://cloud.githubusercontent.com/assets/4137761/22717106/844a9c5c-ed99-11e6-8e88-8c71a8cbbd5a.gif)

Inspired by https://github.com/iamstarkov/hyper-panes-iterm2-hotkeys

## Install

To install, edit `~/.hyper.js` and add `"hyper-pane"` to `plugins`:

```
plugins: [
  "hyper-pane",
],
```

## Configuration

Default configuration:
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
      },
      showIndicators: true, // Show pane number
      indicatorPrefix: '^⌥', // Will be completed with pane number
      indicatorStyle: { // Added to indicator <div>
        position: 'absolute',
        top: 0,
        left: 0,
        fontSize: '10px'
      },
    }
  }
  //...
};
```


## Usage
### Navigation with arrows

Use `Ctrl+Alt+<Up,Down,Left,Right>` (or your configured hotkeys) to navigate to a neighbor pane.

### Jump with digit

Use `Ctrl+Alt+<1-9>` (or your configured hotkeys) to jump directly to a numbered pane.
Panes are ordered "first child descendent" and `9` is reserved to the last pane.

Hotkey indicators are displayed on top left corner of each pane from 2 panes opened.
You can change its content, its style or hide them completly.

### Pane permutation

Adding `Shift` key (or your configured key) to previous hotkeys cause a pane switching.

