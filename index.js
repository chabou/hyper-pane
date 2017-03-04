const Mousetrap = require('mousetrap');
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
  },
  showIndicators: true,
  indicatorPrefix: '^⌥',
  indicatorStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: '10px'
  },
};

let config = defaultConfig;

const debug = function () {
  if (config.debug){
    [].unshift.call(arguments, '|HYPER-PANE|');
    console.log.apply(this, arguments);
  }
};

/**
 * Duplicate Hyper code
 */


const SESSION_SET_ACTIVE = 'SESSION_SET_ACTIVE';
const SESSION_RESIZE = 'SESSION_RESIZE';
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

  return group
    .children
    .reduce((total, childUid) => total.concat(
      findChildSessions(termGroups, childUid)
    ), []);
}

const setActiveSession = (uid, focusPoint) => {
  return dispatch => {
    dispatch({
      type: SESSION_SET_ACTIVE,
      uid,
      focusPoint
    });
  };
}

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
  up: 'UI_MOVE_UP_PANE',
  down: 'UI_MOVE_DOWN_PANE',
  left: 'UI_MOVE_LEFT_PANE',
  right: 'UI_MOVE_RIGHT_PANE'
}

// Others
const ROOT_FRAME = {
  x: 0,
  y: 0,
  w: 1,
  h: 1
};

// For each rootGroup, it sorts its children
function getSortedSessionGroups(termGroups) {
  return getRootGroups(termGroups).reduce((result, {uid}) =>
    Object.assign(result, {[uid]: findChildSessions(termGroups, uid)}), {})
};

// Get the index of the next or previous group,
// depending on the movement direction:
const getNeighborIndex = (groups, uid, type) => {
  console.log('getNeighborIndex', groups, uid, type);
  if (type === UI_MOVE_RIGHT_PANE ||
      type === UI_MOVE_DOWN_PANE) {
    return (groups.indexOf(uid) + 1) % groups.length;
  }

  return (groups.indexOf(uid) + groups.length - 1) % groups.length;
};

const onMoveToPane = dispatch => (index, doSwitch) => {
  dispatch((dispatch, getState) => {
    dispatch({
      type: UI_MOVE_TO_PANE,
      index,
      effect() {
        const { sessions, termGroups } = getState();
        const rootGroupUid = termGroups.activeRootGroup;
        const sortedSessionGroups = findChildSessions(termGroups.termGroups, rootGroupUid);
        const uid = index > sortedSessionGroups.length
          ? null
          : (index === 9
            ? sortedSessionGroups[sortedSessionGroups.length - 1]
            : sortedSessionGroups[index - 1]);
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
            dispatch({
              type: UI_SWITCH_SESSIONS,
              from: activeSessionUid,
              to: nextSessionUid,
            });
          } else {
            dispatch(setActiveSession(nextSessionUid));
          }
        }
      }
    });
  });
};

const isValidNeighborFactory = (direction) => {
  const isHorzontal = (direction === UI_MOVE_RIGHT_PANE || direction === UI_MOVE_LEFT_PANE);
  const coord = isHorzontal ? 'x' : 'y';
  const dimension = isHorzontal ? 'w' : 'h';
  const focusPointCoord = isHorzontal ? 'y' : 'x';
  const focusPointDimension = isHorzontal ? 'h' : 'w';
  const invert = (direction === UI_MOVE_LEFT_PANE || direction === UI_MOVE_UP_PANE);
  return (termGroup, candidate, focusPoint) => {
    if (!candidate.sessionUid) {
      return false;
    }
    //debug('Testing candidate', candidate);
    const first = invert ? candidate : termGroup;
    const second = invert ? termGroup : candidate;
    //debug(first.frame[coord], '+', first.frame[dimension], '-', second.frame[coord]);
    return (first.frame[coord] + first.frame[dimension] - second.frame[coord] < Number.EPSILON)
            && (first.frame[coord] + first.frame[dimension] - second.frame[coord] > -Number.EPSILON)
            && (focusPoint[focusPointCoord] >= candidate.frame[focusPointCoord])
            && (focusPoint[focusPointCoord] <= candidate.frame[focusPointCoord] + candidate.frame[focusPointDimension])

  }
}

const onMoveToDirectionPane = dispatch => (type, doSwitch) => {
  dispatch((dispatch, getState) => {
    dispatch({
      type,
      effect() {
        const { sessions, termGroups, ui } = getState();
        const termGroup = findBySession(termGroups, sessions.activeUid);
        debug('Move Pane', type, termGroup.uid);
        const focusPoint = (ui.paneNavigation && ui.paneNavigation.focusPoint)
          ? ui.paneNavigation.focusPoint.asMutable()
          : {
            x: termGroup.frame.x + termGroup.frame.w / 2,
            y: termGroup.frame.y + termGroup.frame.h / 2,
          };

        const isHorzontal = (type === UI_MOVE_RIGHT_PANE || type === UI_MOVE_LEFT_PANE);
        const coord = isHorzontal ? 'x' : 'y';
        const dimension = isHorzontal ? 'w' : 'h';
        const focusPointCoord = isHorzontal ? 'y' : 'x';
        const focusPointDimension = isHorzontal ? 'h' : 'w';
        const invert = (type === UI_MOVE_LEFT_PANE || type === UI_MOVE_UP_PANE);

        const nextTermGroup = Object.keys(termGroups.termGroups)
          .map(uid => termGroups.termGroups[uid])
          .find(candidate => {
            if (!candidate.sessionUid) {
              return false;
            }
            //debug('Testing candidate', candidate);
            const first = invert ? candidate : termGroup;
            const second = invert ? termGroup : candidate;
            //debug(first.frame[coord], '+', first.frame[dimension], '-', second.frame[coord]);
            return (first.frame[coord] + first.frame[dimension] - second.frame[coord] < Number.EPSILON)
                    && (first.frame[coord] + first.frame[dimension] - second.frame[coord] > -Number.EPSILON)
                    && (focusPoint[focusPointCoord] >= candidate.frame[focusPointCoord])
                    && (focusPoint[focusPointCoord] <= candidate.frame[focusPointCoord] + candidate.frame[focusPointDimension])
          });

        debug('nextTermGroup', nextTermGroup);
        if (nextTermGroup) {
          if (doSwitch) {
            const activeSessionUid = sessions.activeUid;
            dispatch({
              type: UI_SWITCH_SESSIONS,
              from: activeSessionUid,
              to: nextTermGroup.sessionUid,
            });
          } else {
            focusPoint[coord] = nextTermGroup.frame[coord] + nextTermGroup.frame[dimension]/2;
            // If next Pane border is included in current pane border, we can move opposite focusPoint coord accordly
            if (nextTermGroup.frame[focusPointCoord] > termGroup.frame[focusPointCoord]
              && nextTermGroup.frame[focusPointDimension] < termGroup.frame[focusPointDimension]) {
              focusPoint[focusPointCoord] = nextTermGroup.frame[focusPointCoord] + nextTermGroup.frame[focusPointDimension]/2;
            }
            dispatch(setActiveSession(nextTermGroup.sessionUid, focusPoint));
          }
        }
      }
    });
  });
}

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
  const originProp = (group.direction === DIRECTION.HORIZONTAL) ? 'y' : 'x';
  const sizeProp = (group.direction === DIRECTION.HORIZONTAL) ? 'h' : 'w';

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

/**
 * Plugin bindings
 */

exports.middleware = store => next => action => {
  switch (action.type) {
    case 'CONFIG_LOAD':
    case 'CONFIG_RELOAD':
      if (action.config.paneNavigation) {
        config = merge(JSON.parse(JSON.stringify(defaultConfig)), action.config.paneNavigation);
      }
      break;
  }
  return next(action);
}

exports.reduceTermGroups = (state, action) => {

  switch (action.type) {
    case 'UI_SWITCH_SESSIONS':
      const fromTermGroupUid = findBySession(state, action.from).uid;
      const toTermGroupUid = findBySession(state, action.to).uid;
      if (!fromTermGroupUid || !toTermGroupUid) {

        return state;
      }
      debug('Switching sessions for termGroups', fromTermGroupUid, toTermGroupUid);
      state = state.setIn(['termGroups', fromTermGroupUid, 'sessionUid'], action.to)
        .setIn(['termGroups', toTermGroupUid, 'sessionUid'], action.from);
      break;
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
}

exports.reduceUI = (state, action) => {
  switch (action.type) {
    case SESSION_SET_ACTIVE:
        state = state.setIn(['paneNavigation', 'focusPoint'], action.focusPoint);
      break;
  }
  return state;
}

exports.mapTermsState = (state, map) => {
  const result = getSortedSessionGroups(state.termGroups.termGroups);
  return Object.assign({}, map, {sortedSessionGroups: result});
};

exports.getTermGroupProps = (uid, parentProps, props) => {
  const { sortedSessionGroups, onMoveToPane, onSwitchWithActiveSession } = parentProps;
  return Object.assign({}, props, {sortedSessionGroups: sortedSessionGroups[uid]});
};

exports.getTermProps = (uid, parentProps, props) => {
  const { termGroup, sortedSessionGroups } = parentProps;
  const index = sortedSessionGroups.indexOf(termGroup.uid);
  // Only 1-9 keys are used and if there is more than 9 terms, number 9 is reserved to the last term
  let termShorcutNum = 0;
  if (sortedSessionGroups.length === 1) {
    termShorcutNum = 0;
  } else if (index < 8 ) {
    termShorcutNum = index + 1;
  } else if (index === sortedSessionGroups.length - 1) {
    termShorcutNum = 9;
  }
  //debug('Setting Shortcutnum', termShorcutNum, 'to Term', uid);
  return Object.assign({}, props, {termShorcutNum});
};

exports.mapTermsDispatch = (dispatch, map) => {
  map.onMoveToPane = onMoveToPane(dispatch);
  //map.onSwitchWithActiveSession = onSwitchWithActiveSession(dispatch);
  map.onMoveToDirectionPane = onMoveToDirectionPane(dispatch);
  return map;
}

exports.decorateTerms = (Terms, { React, notify, Notification }) => {
  return class extends React.Component {
    constructor(props, context) {
      super(props, context);
      this.handleFocusActive = this.handleFocusActive.bind(this);
      this.onTermsRef = this.onTermsRef.bind(this);
    }

    handleFocusActive() {
      const term = this.terms.getActiveTerm();
      if (term) {
        term.focus();
      }
    }

    reattachKeyListner() {
      if (this.keys) {
        this.keys.reset();
      }
      this.handleFocusActive();
      this.attachKeyListeners();
    }

    attachKeyListeners() {
      const term = this.terms.getActiveTerm();
      if (!term) {
        return;
      }
      const document = term.getTermDocument();
      const keys = new Mousetrap(document);

      const jump_prefix = config.hotkeys.jump_prefix.toLowerCase();
      const permutation_modifier = config.hotkeys.permutation_modifier.toLowerCase();
      if (jump_prefix && jump_prefix.length) {
        ['1','2','3','4','5','6','7','8','9'].forEach(num => {
          let shortcut = jump_prefix+ `+${num}`;
          //debug('Add shortcut', shortcut);
          keys.bind(
            shortcut,
            (e) => {
              this.props.onMoveToPane(num);
              e.preventDefault();
              this.reattachKeyListner();
            }
          );
          if (permutation_modifier && permutation_modifier.length) {
            shortcut = `${permutation_modifier} + ${shortcut}`;
            //debug('Add shortcut', shortcut);
            keys.bind(
              shortcut,
              (e) => {
                this.props.onMoveToPane(num, true);
                e.preventDefault();
                this.reattachKeyListner();
              }
            );
          }
        });
      }

      Object.keys(config.hotkeys.navigation).forEach(direction => {
        const key = config.hotkeys.navigation[direction].toLowerCase();
        const actionType = navigationActionMap[direction];
        if (key && key.length && actionType && actionType.length) {
          keys.bind(
            key,
            (e) => {
              this.props.onMoveToDirectionPane(actionType);
              e.preventDefault();
              this.reattachKeyListner();
            }
          );
          if (permutation_modifier && permutation_modifier.length) {
            keys.bind(
              `${permutation_modifier}+` + key,
              (e) => {
                this.props.onMoveToDirectionPane(actionType, true);
                e.preventDefault();
                this.reattachKeyListner();
              }
            );
          }
        }
      });
      this.keys = keys;
    }

    onTermsRef(terms) {
      this.terms = terms;
    }

    componentDidUpdate(prev) {
      if (prev.activeSession !== this.props.activeSession) {
        this.reattachKeyListner();
      }
    }

    componentWillUnmount() {
      if (this.keys) {
        this.keys.reset();
      }
    }

    render() {
      return React.createElement(Terms, Object.assign({}, this.props, {
        ref: this.onTermsRef
      }));
    }
  }
}

exports.decorateTerm = (Term, { React, notify }) => {
  return class extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.onTermRef = this.onTermRef.bind(this);
        this.onMouseEnter = this.onMouseEnter.bind(this);
    }

    onMouseEnter(e) {
      debug('Mouse is hover Term', this.term);
      if (config.focusOnMouseHover && !this.term.props.isTermActive) {
        this.term.props.onActive(this.term.props.uid);
      }
    }

    componentDidMount() {
      const doc = this.term.getTermDocument();
      doc.body.onmouseenter = this.onMouseEnter;
    }

    onTermRef(term) {
      this.term = term;
    }

    render () {
      if (!config.showIndicators) {
        return React.createElement(Term, this.props);
      }
      const myCustomChildrenBefore = React.createElement(
        'div',
        {
          style: config.indicatorStyle
        },
        this.props.termShorcutNum > 0 ? config.indicatorPrefix + this.props.termShorcutNum : ''
      );
      const customChildrenBefore = this.props.customChildrenBefore
        ? Array.from(this.props.customChildrenBefore).concat(myCustomChildrenBefore)
        : myCustomChildrenBefore;
      return React.createElement(Term, Object.assign({}, this.props, {customChildrenBefore, ref: this.onTermRef}));
    }
  }
}



