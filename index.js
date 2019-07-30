const merge = require('lodash.merge');

const defaultConfig = {
  debug: false,
  hotkeys: {
    navigation: {
      up: 'ctrl+alt+up',
      down: 'ctrl+alt+down',
      left: 'ctrl+alt+left',
      right: 'ctrl+alt+right'
    },
    jump_prefix: 'ctrl+alt',
    permutation_modifier: 'shift',
    maximize: 'cmd+enter'
  },
  showIndicators: true,
  indicatorPrefix: '^⌥',
  indicatorStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: '10px'
  },
  focusOnMouseHover: false,
  inactivePaneOpacity: 0.8
};

let config = defaultConfig;

const debug = function() {
  if (config.debug) {
    [].unshift.call(arguments, '|HYPER-PANE|');
    //eslint-disable-next-line no-console
    console.log.apply(this, arguments);
  }
};

/**
 * Duplicate Hyper code
 */

const SESSION_SET_ACTIVE = 'SESSION_SET_ACTIVE';
const SESSION_ADD = 'SESSION_ADD';
const TERM_GROUP_RESIZE = 'TERM_GROUP_RESIZE';
const TERM_GROUP_EXIT = 'TERM_GROUP_EXIT';
const DIRECTION = {
  HORIZONTAL: 'HORIZONTAL',
  VERTICAL: 'VERTICAL'
};

function getRootGroups(termGroups) {
  return Object.keys(termGroups)
    .map(uid => termGroups[uid])
    .filter(({parentUid}) => !parentUid);
}

// Find all sessions that are below the given
// termGroup uid in the hierarchy:
function findChildSessions(termGroups, uid) {
  const group = termGroups[uid];
  if (group.sessionUid) {
    return [uid];
  }

  return group.children.reduce((total, childUid) => total.concat(findChildSessions(termGroups, childUid)), []);
}

const setActiveSession = (uid, focusPoint) => {
  return dispatch => {
    dispatch({
      type: SESSION_SET_ACTIVE,
      uid,
      focusPoint
    });
  };
};

function findBySession(termGroupState, sessionUid) {
  const {termGroups} = termGroupState;
  return Object.keys(termGroups)
    .map(uid => termGroups[uid])
    .find(group => group.sessionUid === sessionUid);
}

/**
 * Plugin Code
 */
// Action types
const UI_MOVE_TO_PANE = 'UI_MOVE_TO_PANE';
const UI_MOVE_UP_PANE = 'UI_MOVE_UP_PANE';
const UI_MOVE_DOWN_PANE = 'UI_MOVE_DOWN_PANE';
const UI_MOVE_LEFT_PANE = 'UI_MOVE_LEFT_PANE';
const UI_MOVE_RIGHT_PANE = 'UI_MOVE_RIGHT_PANE';
const UI_SWITCH_SESSIONS = 'UI_SWITCH_SESSIONS';

const navigationActionMap = {
  up: UI_MOVE_UP_PANE,
  down: UI_MOVE_DOWN_PANE,
  left: UI_MOVE_LEFT_PANE,
  right: UI_MOVE_RIGHT_PANE
};

// Others
const ROOT_FRAME = {
  x: 0,
  y: 0,
  w: 1,
  h: 1
};

const hiddenTerms = {};

// For each rootGroup, it sorts its children
function getSortedSessionGroups(termGroups) {
  return getRootGroups(termGroups).reduce(
    (result, {uid}) => Object.assign(result, {[uid]: findChildSessions(termGroups, uid)}),
    {}
  );
}

const onMoveToPane = dispatch => (index, doSwitch) => {
  dispatch((dispatch_, getState) => {
    dispatch_({
      type: UI_MOVE_TO_PANE,
      index,
      effect() {
        const {sessions, termGroups} = getState();
        const rootGroupUid = termGroups.activeRootGroup;
        const sortedSessionGroups = findChildSessions(termGroups.termGroups, rootGroupUid);
        const uid =
          index > sortedSessionGroups.length
            ? null
            : index === 9 ? sortedSessionGroups[sortedSessionGroups.length - 1] : sortedSessionGroups[index - 1];
        if (uid === null) {
          debug('ignoring inexistent index', index);
          return;
        }
        const nextSessionUid = termGroups.termGroups[uid].sessionUid;
        if (sessions.activeUid === nextSessionUid) {
          debug('ignoring same uid');
        } else {
          if (doSwitch) {
            const activeSessionUid = sessions.activeUid;
            dispatch_({
              type: UI_SWITCH_SESSIONS,
              from: activeSessionUid,
              to: nextSessionUid
            });
          } else {
            dispatch_(setActiveSession(nextSessionUid));
          }
        }
      }
    });
  });
};

const onMoveToDirectionPane = dispatch => (type, doSwitch) => {
  dispatch((dispatch_, getState) => {
    dispatch_({
      type,
      effect() {
        const {sessions, termGroups, ui} = getState();
        const termGroup = findBySession(termGroups, sessions.activeUid);
        debug('Move Pane', type, termGroup.uid);
        const focusPoint =
          ui.paneNavigation && ui.paneNavigation.focusPoint
            ? ui.paneNavigation.focusPoint.asMutable()
            : {
                x: termGroup.frame.x + termGroup.frame.w / 2,
                y: termGroup.frame.y + termGroup.frame.h / 2
              };

        const isHorzontal = type === UI_MOVE_RIGHT_PANE || type === UI_MOVE_LEFT_PANE;
        const coord = isHorzontal ? 'x' : 'y';
        const dimension = isHorzontal ? 'w' : 'h';
        const focusPointCoord = isHorzontal ? 'y' : 'x';
        const focusPointDimension = isHorzontal ? 'h' : 'w';
        const invert = type === UI_MOVE_LEFT_PANE || type === UI_MOVE_UP_PANE;

        const rootGroupUid = termGroups.activeRootGroup;
        const sortedSessionGroups = findChildSessions(termGroups.termGroups, rootGroupUid);
        const nextTermGroup = sortedSessionGroups.map(uid => termGroups.termGroups[uid]).find(candidate => {
          if (!candidate.sessionUid) {
            return false;
          }
          //debug('Testing candidate', candidate);
          const first = invert ? candidate : termGroup;
          const second = invert ? termGroup : candidate;
          //debug(first.frame[coord], '+', first.frame[dimension], '-', second.frame[coord]);
          return (
            first.frame[coord] + first.frame[dimension] - second.frame[coord] < Number.EPSILON &&
            first.frame[coord] + first.frame[dimension] - second.frame[coord] > -Number.EPSILON &&
            focusPoint[focusPointCoord] >= candidate.frame[focusPointCoord] &&
            focusPoint[focusPointCoord] <= candidate.frame[focusPointCoord] + candidate.frame[focusPointDimension]
          );
        });

        debug('nextTermGroup', nextTermGroup);
        if (nextTermGroup) {
          if (doSwitch) {
            const activeSessionUid = sessions.activeUid;
            dispatch_({
              type: UI_SWITCH_SESSIONS,
              from: activeSessionUid,
              to: nextTermGroup.sessionUid
            });
          } else {
            focusPoint[coord] = nextTermGroup.frame[coord] + nextTermGroup.frame[dimension] / 2;
            // If next Pane border is included in current pane border, we can move opposite focusPoint coord accordly
            if (
              nextTermGroup.frame[focusPointCoord] > termGroup.frame[focusPointCoord] &&
              nextTermGroup.frame[focusPointDimension] < termGroup.frame[focusPointDimension]
            ) {
              focusPoint[focusPointCoord] =
                nextTermGroup.frame[focusPointCoord] + nextTermGroup.frame[focusPointDimension] / 2;
            }
            dispatch_(setActiveSession(nextTermGroup.sessionUid, focusPoint));
          }
        }
      }
    });
  });
};

const updateChildrenFrames = (state, groupUid) => {
  debug('updateChildrenFrames: call on', groupUid);
  if (!groupUid) {
    debug('WARNING: undefined groupUid');
    return state;
  }
  const group = state.termGroups[groupUid];
  if (!group) {
    debug('WARNING: undefined group for groupUid', groupUid);
    return state;
  }

  if (group.sessionUid && group.parentUid) {
    debug('updateChildrenFrames: sessionUid found, skipping', group.sessionUid);
    return state;
  }
  if (group.children.length === 0) {
    debug('updateChildrenFrames: no children found, skipping', group.sessionUid);
    if (!group.parentUid) {
      state = state.setIn(['termGroups', group.uid, 'frame'], ROOT_FRAME);
    }
    return state;
  }
  const originProp = group.direction === DIRECTION.HORIZONTAL ? 'y' : 'x';
  const sizeProp = group.direction === DIRECTION.HORIZONTAL ? 'h' : 'w';

  let currentOrigin = group.frame[originProp];
  for (let i = 0; i < group.children.length; i++) {
    debug('dealing child', group.children[i]);
    const child = state.termGroups[group.children[i]];
    const size = group.frame[sizeProp] * (group.sizes ? group.sizes[i] : 1 / group.children.length);
    debug('Setting frame for', child, currentOrigin, size);
    const frame = group.frame.asMutable();
    frame[originProp] = currentOrigin;
    frame[sizeProp] = size;

    state = state.setIn(['termGroups', child.uid, 'frame'], frame);

    state = updateChildrenFrames(state, child.uid);

    currentOrigin += size;
  }

  return state;
};

const onMaximizePane = dispatch => () => {
  debug('onMaximizePane');
  dispatch((dispatch_, getState) => {
    const {sessions, termGroups} = getState();
    const termGroup = findBySession(termGroups, sessions.activeUid);
    if (!termGroup) {
      debug('No termGroup found for active Session');
      return;
    }
    dispatch_({
      type: 'UI_MAXIMIZE_PANE',
      uid: termGroup.uid
    });
  });
};

/**
 * Plugin bindings
 */

exports.decorateConfig = mainConfig => {
  if (mainConfig.paneNavigation) {
    config = merge(JSON.parse(JSON.stringify(defaultConfig)), mainConfig.paneNavigation);
  }
  if (config.inactivePaneOpacity < 1) {
    mainConfig.css += `
      .term_fit:not(.term_term):not(.term_wrapper):not(.term_active) {
        opacity: ${config.inactivePaneOpacity};
      }
      .term_fit.term_active {
        opacity: 1;
        transition: opacity 0.06s ease-in-out;
        will-change: opacity;
      }
    `;
  }
  debug('Decorated config', mainConfig);
  return mainConfig;
};

exports.middleware = store => next => action => {
  switch (action.type) {
    case 'CONFIG_LOAD':
    case 'CONFIG_RELOAD':
      if (action.config.paneNavigation) {
        config = merge(JSON.parse(JSON.stringify(defaultConfig)), action.config.paneNavigation);
      }
      break;
    case 'SESSION_ADD':
      {
        const {termGroups} = store.getState();
        if (termGroups.maximizeSave && termGroups.maximizeSave[termGroups.activeRootGroup]) {
          // Current Pane is maximized, restore it before adding a potential split
          store.dispatch({
            type: 'UI_MAXIMIZE_PANE',
            uid: termGroups.activeRootGroup
          });
        }
      }
      break;
    case 'SESSION_PTY_DATA': {
      // Hyper doesn't send data if Term is unmounted
      const term = hiddenTerms[action.uid];
      if (term) {
        term.write(action.data);
      }
      break;
    }
  }
  return next(action);
};

exports.reduceTermGroups = (state, action) => {
  switch (action.type) {
    case 'UI_MAXIMIZE_PANE':
      {
        if (!state.maximizeSave || !state.maximizeSave[action.uid]) {
          // Maximize
          debug('Maximizing', action.uid);
          const {parentUid, sessionUid} = state.termGroups[action.uid];
          if (!parentUid) {
            debug('No parent for this session, maximize discarded');
            break;
          }
          state = state.setIn(['maximizeSave', action.uid], {
            activeRootGroup: state.activeRootGroup,
            parentUid,
            sessionUid
          });
          state = state.setIn(['termGroups', action.uid, 'parentUid'], null);
          state = state.setIn(['termGroups', state.activeRootGroup, 'parentUid'], 'fakeParent'); // fake parentUid to prevent getRootGroups selector to include it
          state = state.setIn(['activeSessions', action.uid], sessionUid);
          state = state.set('activeSessions', state.activeSessions.without(state.activeRootGroup));
          state = state.set('activeRootGroup', action.uid);
        } else {
          // Restore
          debug('Restoring', action.uid);
          const {activeRootGroup, parentUid, sessionUid} = state.maximizeSave[action.uid];
          state = state.setIn(['termGroups', action.uid, 'parentUid'], parentUid);
          state = state.setIn(['termGroups', activeRootGroup, 'parentUid'], null);
          state = state.setIn(['activeSessions', activeRootGroup], sessionUid);
          state = state.set('activeSessions', state.activeSessions.without(action.uid));
          state = state.set('activeRootGroup', activeRootGroup);
          state = state.set('maximizeSave', state.maximizeSave.without(action.uid));
        }
      }
      break;
    case 'UI_SWITCH_SESSIONS': {
      const fromTermGroupUid = findBySession(state, action.from).uid;
      const toTermGroupUid = findBySession(state, action.to).uid;
      if (!fromTermGroupUid || !toTermGroupUid) {
        return state;
      }
      debug('Switching sessions for termGroups', fromTermGroupUid, toTermGroupUid);
      state = state
        .setIn(['termGroups', fromTermGroupUid, 'sessionUid'], action.to)
        .setIn(['termGroups', toTermGroupUid, 'sessionUid'], action.from);
      break;
    }
    case SESSION_ADD:
      if (!state.activeRootGroup) {
        break;
      }
      state = updateChildrenFrames(state, state.activeRootGroup);
      break;
    case TERM_GROUP_RESIZE:
    case TERM_GROUP_EXIT: {
      if (!state.activeRootGroup) {
        break;
      }
      let rootGroupUid = state.activeRootGroup;
      if (!state.termGroups[rootGroupUid]) {
        // This should not happen but it's a protection: See https://github.com/chabou/hyper-pane/issues/3
        rootGroupUid = state.activeTermGroup;
      }
      state = updateChildrenFrames(state, rootGroupUid);
      break;
    }
  }

  return state;
};

exports.reduceUI = (state, action) => {
  switch (action.type) {
    case SESSION_SET_ACTIVE:
      state = state.setIn(['paneNavigation', 'focusPoint'], action.focusPoint);
      break;
  }
  return state;
};

exports.mapTermsState = (state, map) => {
  const sortedSessionGroups = getSortedSessionGroups(state.termGroups.termGroups);
  const maximizedTermGroups = state.termGroups.maximizeSave;
  return Object.assign({}, map, {sortedSessionGroups, maximizedTermGroups});
};

exports.getTermGroupProps = (uid, parentProps, props) => {
  const {sortedSessionGroups, activeRootGroup, maximizedTermGroups} = parentProps;
  if (sortedSessionGroups[activeRootGroup]) {
    props = Object.assign(props, {
      sortedSessionGroups: sortedSessionGroups[activeRootGroup]
    });
  }
  props = Object.assign(props, {
    isMaximized: !!(maximizedTermGroups && maximizedTermGroups[uid])
  });
  return props;
};

exports.getTermProps = (uid, parentProps, props) => {
  const {termGroup, sortedSessionGroups, isMaximized} = parentProps;
  if (!sortedSessionGroups) {
    return props;
  }
  const index = sortedSessionGroups.indexOf(termGroup.uid);
  // Only 1-9 keys are used and if there is more than 9 terms, number 9 is reserved to the last term
  let termShorcutNum = 0;
  if (sortedSessionGroups.length === 1) {
    termShorcutNum = 0;
  } else if (index < 8) {
    termShorcutNum = index + 1;
  } else if (index === sortedSessionGroups.length - 1) {
    termShorcutNum = 9;
  }

  //debug('Setting Shortcutnum', termShorcutNum, 'to Term', uid);
  return Object.assign({}, props, {termShorcutNum, isMaximized});
};

exports.mapTermsDispatch = (dispatch, map) => {
  map.onMoveToPane = onMoveToPane(dispatch);
  //map.onSwitchWithActiveSession = onSwitchWithActiveSession(dispatch);
  map.onMoveToDirectionPane = onMoveToDirectionPane(dispatch);
  map.onMaximizePane = onMaximizePane(dispatch);
  return map;
};

exports.decorateKeymaps = keymaps => {
  const keys = {};
  const jump_prefix = config.hotkeys.jump_prefix ? config.hotkeys.jump_prefix.toLowerCase() : '';
  const permutation_modifier = config.hotkeys.permutation_modifier
    ? config.hotkeys.permutation_modifier.toLowerCase()
    : '';
  let shortcut;
  let name;

  if (jump_prefix && jump_prefix.length) {
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(num => {
      shortcut = `${jump_prefix}+${num}`;
      name = `pane:move_${num}`;
      keys[name] = shortcut;
      if (permutation_modifier && permutation_modifier.length) {
        shortcut = `${permutation_modifier}+${shortcut}`;
        name = `pane:switch_${num}`;
        keys[name] = shortcut;
      }
    });
  }

  Object.keys(config.hotkeys.navigation).forEach(direction => {
    const key = config.hotkeys.navigation[direction].toLowerCase();
    const actionType = navigationActionMap[direction];

    if (key && key.length && actionType && actionType.length) {
      shortcut = key;
      name = `pane:move_${direction}`;
      keys[name] = shortcut;
      if (permutation_modifier && permutation_modifier.length) {
        shortcut = `${permutation_modifier}+${key}`;
        name = `pane:switch_${direction}`;
        keys[name] = shortcut;
      }
    }
  });

  const maximize = config.hotkeys.maximize ? config.hotkeys.maximize.toLowerCase() : '';
  if (maximize.length) {
    shortcut = maximize;
    name = 'pane:maximize';
    keys[name] = shortcut;
  }

  debug('Extend keymaps with', keys);
  return Object.assign({}, keymaps, keys);
};

exports.decorateTerms = (Terms, {React}) => {
  return class extends React.Component {
    constructor(props, context) {
      super(props, context);
      this.handleFocusActive = this.handleFocusActive.bind(this);
      this.onDecorated = this.onDecorated.bind(this);
    }

    handleFocusActive() {
      if (!this.terms.getActiveTerm) {
        return;
      }
      const term = this.terms.getActiveTerm();
      if (term) {
        term.focus();
      }
    }

    generateCommands() {
      let name;
      let handler;
      let commands = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].reduce((commands_, num) => {
        name = `pane:move_${num}`;
        handler = e => {
          this.props.onMoveToPane(num);
          e.preventDefault();
        };
        commands_[name] = handler;

        name = `pane:switch_${num}`;
        handler = e => {
          this.props.onMoveToPane(num, true);
          e.preventDefault();
        };
        commands_[name] = handler;

        return commands_;
      }, {});

      commands = Object.keys(navigationActionMap).reduce((commands_, direction) => {
        const actionType = navigationActionMap[direction];
        name = `pane:move_${direction}`;
        handler = e => {
          this.props.onMoveToDirectionPane(actionType);
          e.preventDefault();
        };
        commands_[name] = handler;

        name = `pane:switch_${direction}`;
        handler = e => {
          this.props.onMoveToDirectionPane(actionType, true);
          e.preventDefault();
        };
        commands_[name] = handler;

        return commands_;
      }, commands);

      name = 'pane:maximize';
      handler = e => {
        this.props.onMaximizePane();
        this.handleFocusActive();
        e.preventDefault();
      };
      commands[name] = handler;

      return commands;
    }

    onDecorated(terms) {
      debug('onDecorated', terms);
      this.terms = terms;
      if (this.props.onDecorated) {
        this.props.onDecorated(terms);
      }
      if (this.terms) {
        this.terms.registerCommands(this.generateCommands());
      }
    }

    render() {
      return React.createElement(
        Terms,
        Object.assign({}, this.props, {
          onDecorated: this.onDecorated
        })
      );
    }
  };
};

exports.decorateTerm = (Term, {React}) => {
  return class extends React.Component {
    constructor(props, context) {
      super(props, context);
      this.onDecorated = this.onDecorated.bind(this);
      this.onMouseEnter = this.onMouseEnter.bind(this);
    }

    onMouseEnter() {
      debug('Mouse is hover Term', this.term);
      if (config.focusOnMouseHover && !this.term.props.isTermActive) {
        this.term.props.onActive(this.term.props.uid);
      }
    }

    onDecorated(term) {
      debug('Keep term ref');
      this.term = term;
      if (this.term && this.term.termRef) {
        this.term.termRef.onmouseenter = this.onMouseEnter;
      } else if (this.term && this.term.getTermDocument) {
        // Backward compatibility
        const doc = this.term.getTermDocument();
        if (doc && doc.body) {
          doc.body.onmouseenter = this.onMouseEnter;
        }
      }
      if (this.props.onDecorated) {
        this.props.onDecorated(term);
      }
    }

    componentWillUnmount() {
      // Keep reference to hidden terms to write PTY data.
      // Hyper doesn't send them if Term is unmounted
      hiddenTerms[this.props.uid] = this.term.term;
    }
    componentDidMount() {
      hiddenTerms[this.props.uid] = null;
    }

    render() {
      const props = {
        onDecorated: this.onDecorated
      };

      //return toto.titi;
      let indicator;
      if (config.showIndicators) {
        if (this.props.isMaximized) {
          indicator = '🗖';
        } else if (this.props.termShorcutNum > 0) {
          indicator = config.indicatorPrefix + this.props.termShorcutNum;
        }
      }

      if (!indicator) {
        return React.createElement(Term, Object.assign({}, this.props, props));
      }
      const myCustomChildrenBefore = React.createElement(
        'div',
        {
          key: 'pane',
          style: config.indicatorStyle
        },
        indicator
      );
      const customChildrenBefore = this.props.customChildrenBefore
        ? Array(this.props.customChildrenBefore).concat(myCustomChildrenBefore)
        : myCustomChildrenBefore;
      props.customChildrenBefore = customChildrenBefore;
      return React.createElement(Term, Object.assign({}, this.props, props));
    }
  };
};
