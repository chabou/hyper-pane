const Mousetrap = require('mousetrap');

let debug_enabled_ = true;

const debug = function () {
  if (debug_enabled_){
    [].unshift.call(arguments, '|HYPER-PANE|');
    console.log.apply(this, arguments);
  }
}

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

const setActiveSession = (uid) => {
  return dispatch => {
    dispatch({
      type: SESSION_SET_ACTIVE,
      uid
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

// Keys
const JUMP_KEYS = 'ctrl+alt';
const SWITCH_KEYS = 'ctrl+alt+shift';
const NAV_KEYS = {
  UI_MOVE_UP_PANE: 'ctrl+alt+up',
  UI_MOVE_DOWN_PANE: 'ctrl+alt+down',
  UI_MOVE_LEFT_PANE: 'ctrl+alt+left',
  UI_MOVE_RIGHT_PANE: 'ctrl+alt+right'
};

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

const onMoveToPane = (dispatch) => (i) => {
  dispatch((dispatch, getState) => {
    dispatch({
      type: UI_MOVE_TO_PANE,
      index: i,
      effect() {
        const state = getState();
        const rootGroupUid = state.termGroups.activeRootGroup;
        const sortedSessionGroups = findChildSessions(state.termGroups.termGroups, rootGroupUid);
        const uid = i > sortedSessionGroups.length ? null : (i === 9 ? sortedSessionGroups[sortedSessionGroups.length - 1] : sortedSessionGroups[i - 1]);
        if (uid === null) {
          debug('ignoring inexistent index', i);
          return;
        }
        const nextSessionUid = state.termGroups.termGroups[uid].sessionUid;
        if (state.sessions.activeUid === nextSessionUid) {
          debug('ignoring same uid');
        } else {
          dispatch(setActiveSession(nextSessionUid));
        }
      }
    });
  });
};

const onSwitchWithActiveSession = (dispatch) => (i, terms) => {
  dispatch((dispatch, getState) => {
    const state = getState();
    const activeSessionUid = state.sessions.activeUid;
    const rootGroupUid = state.termGroups.activeRootGroup;
    const sortedSessionGroups = findChildSessions(state.termGroups.termGroups, rootGroupUid);
    const uid = i > sortedSessionGroups.length ? null : (i === 9 ? sortedSessionGroups[sortedSessionGroups.length - 1] : sortedSessionGroups[i - 1]);
    if (uid === null) {
      debug('ignoring inexistent index', i);
      return;
    }
    const nextSessionUid = state.termGroups.termGroups[uid].sessionUid;
    if (state.sessions.activeUid === nextSessionUid) {
      debug('ignoring same uid');
      return;
    }
    dispatch({
      type: UI_SWITCH_SESSIONS,
      from: activeSessionUid,
      to: nextSessionUid,
    });

    debug('Terms', terms);

  });
};

const onMoveToDirectionPane = (dispatch) => (type) => {
  dispatch((dispatch, getState) => {
    dispatch({
      type,
      effect() {
        const {sessions, termGroups} = getState();
        const termGroup = findBySession(termGroups, sessions.activeUid);
        debug('Move Pane', type, termGroup.uid);
        if (termGroup.parentUid === null) {
          debug('ignoring move for single group');
        } else {
          let parentGroup = termGroups.termGroups[termGroup.parentUid];
          let currentChildUid = termGroup.uid;
          const moveDirection = (type === UI_MOVE_RIGHT_PANE || type === UI_MOVE_LEFT_PANE) ? DIRECTION.VERTICAL : DIRECTION.HORIZONTAL;
          // looking for the first parent with a compatible direction.
          while (parentGroup !== undefined && parentGroup.direction !== moveDirection) {
            currentChildUid = parentGroup.uid;
            parentGroup = parentGroup.parentUid ? termGroups.termGroups[parentGroup.parentUid] : undefined;
          }
          if (parentGroup) {
            // remain in the same termGroup
            debug('ParentGroup found', parentGroup.uid);
            const index = getNeighborIndex(parentGroup.children, currentChildUid, type);
            debug('index', index);
            let target = termGroups.termGroups[parentGroup.children[index]];
            // looking for the first child with a sessionUid (ie. not a container)
            while (target && target.sessionUid === null && target.children.length) {
              debug('No sessionUid in', target.uid);
              target = termGroups.termGroups[target.children[0]];
              debug('Testing', target.uid);
            }
            if (target.sessionUid) {
              dispatch(setActiveSession(target.sessionUid));
            } else {
              console.warn('No sessionUid found for', target.uid);
            }
          }
        }
      }
    });
  });
}

const updateChildrenFrames = (state, groupUid) => {
  debug('updateChildrenFrames: call on', groupUid);
  const group = state.termGroups[groupUid];
  if (group.sessionUid) {
    debug('updateChildrenFrames: sessionUid found, skipping', group.sessionUid);
    return state;
  }
  if (group.children.length === 0) {
    debug('updateChildrenFrames: no children found, skipping', group.sessionUid);
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
      if (state.activeRootGroup && !state.termGroups[state.activeRootGroup].frame) {
        // Init rootFrame
        state = state.setIn(['termGroups', state.activeRootGroup, 'frame'], ROOT_FRAME);
      }
    case TERM_GROUP_RESIZE:
    case TERM_GROUP_EXIT: {
      state.activeRootGroup && (state = updateChildrenFrames(state, state.activeRootGroup));
      break;
    }

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
  debug('Setting Shortcutnum', termShorcutNum, 'to Term', uid);
  return Object.assign({}, props, {termShorcutNum});
};

exports.mapTermsDispatch = (dispatch, map) => {
  map.onMoveToPane = onMoveToPane(dispatch);
  map.onSwitchWithActiveSession = onSwitchWithActiveSession(dispatch);
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

      ['1','2','3','4','5','6','7','8','9'].forEach(num => {
        let shortcut = JUMP_KEYS + `+${num}`;
        debug('Add shortcut', shortcut);
        keys.bind(
          shortcut,
          (e) => {
            this.props.onMoveToPane(num);
            e.preventDefault();
            this.reattachKeyListner();
          }
        );
        shortcut = SWITCH_KEYS + `+${num}`;
        debug('Add shortcut', shortcut);
        keys.bind(
          shortcut,
          (e) => {
            this.props.onSwitchWithActiveSession(num, this.terms);
            e.preventDefault();
            this.reattachKeyListner();
          }
        );
      });

      Object.keys(NAV_KEYS).forEach(direction => {
        keys.bind(
          NAV_KEYS[direction],
          (e) => {
            this.props.onMoveToDirectionPane(direction)
          }
        );
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
  debug('Decorate Term', Term);
  return class extends React.Component {
    constructor(props, context) {
        super(props, context);
    }
    render () {
      const myCustomChildrenBefore = React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            fontSize: '10px'
          }
        },
        this.props.termShorcutNum > 0 ? '^⌘' + this.props.termShorcutNum : ''
      );
      const customChildrenBefore = this.props.customChildrenBefore
        ? Array.from(this.props.customChildrenBefore).concat(myCustomChildrenBefore)
        : myCustomChildrenBefore;
      return React.createElement(Term, Object.assign({}, this.props, {customChildrenBefore}));
    }
  }
}

