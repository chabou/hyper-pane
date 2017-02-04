let debug_enabled_ = true;

const React = require('React');

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

/**
 * Plugin Code
 */

const UI_MOVE_TO_PANE = 'UI_MOVE_TO_PANE';
const UI_SWITCH_SESSIONS = 'UI_SWITCH_SESSIONS';

// For each rootGroup, it sorts its children
function getSortedSessionGroups(termGroups) {
  return getRootGroups(termGroups).reduce((result, {uid}) =>
    Object.assign(result, {[uid]: findChildSessions(termGroups, uid)}), {})
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

const onSwitchWithActiveSession = (dispatch) => (i) => {
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
      effect() {
        // TODO: dispatch a SESSION_RESIZE for each session
      }
    });
  });
};

const isValidIndex = (index) => index > 0 && index <=9;

const keydownHandler = (onMoveToPane, onSwitchWithActiveSession) => (e) => {
    debug('Keydown', e);

    if (!e.ctrlKey || !e.metaKey) {
      return;
    }

    let index = e.keyCode - 48;
    if (!isValidIndex(index)) {
      index = parseInt(e.key, 10);
      if (!isValidIndex(e.key)) {
        return;
      }
    }

    if (e.shiftKey) {
      debug('switchWithPane', index);
      onSwitchWithActiveSession(index);
      return;
    }

    debug('moveToPane', index);
    onMoveToPane(index);
};

const findTermGroupWithSessionUid = (termGroups, sessionUid) => {
  debug('Looking for session', sessionUid, 'in', termGroups);
  const keys = Object.keys(termGroups);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const termGroup = termGroups[key];
    if (termGroup.sessionUid === sessionUid) {
      return key;
    }
  }
}


/**
 * Plugin bindings
 */

exports.reduceTermGroups = (state, action) => {
  if (action.type === 'UI_SWITCH_SESSIONS') {
    const fromTermGroupUid = findTermGroupWithSessionUid(state.termGroups, action.from);
    const toTermGroupUid = findTermGroupWithSessionUid(state.termGroups, action.to);
    if (!fromTermGroupUid || !toTermGroupUid) {

      return state;
    }
    debug('Switching sessions for termGroups', fromTermGroupUid, toTermGroupUid);
    state = state.setIn(['termGroups', fromTermGroupUid, 'sessionUid'], action.to)
      .setIn(['termGroups', toTermGroupUid, 'sessionUid'], action.from);
  }
  return state;
}

exports.mapTermsState = (state, map) => {
  const result = getSortedSessionGroups(state.termGroups.termGroups);
  return Object.assign({}, map, {sortedSessionGroups: result});
};

exports.getTermGroupProps = (uid, parentProps, props) => {
  const { sortedSessionGroups, onMoveToPane, onSwitchWithActiveSession } = parentProps;
  return Object.assign({}, props, {sortedSessionGroups: sortedSessionGroups[uid], onMoveToPane, onSwitchWithActiveSession});
};

exports.getTermProps = (uid, parentProps, props) => {
  const { termGroup, sortedSessionGroups, onMoveToPane, onSwitchWithActiveSession } = parentProps;
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
  return Object.assign({}, props, {termShorcutNum, onMoveToPane, onSwitchWithActiveSession});
};

exports.mapTermsDispatch = (dispatch, map) => {
  map.onMoveToPane = onMoveToPane(dispatch);
  map.onSwitchWithActiveSession = onSwitchWithActiveSession(dispatch);
  return map;
}

exports.decorateTerm = (Term, { React, notify }) => {
  debug('Decorate Term', Term);
  return class extends React.Component {
    constructor(props, context) {
        super(props, context);
        this._onTerminal = this._onTerminal.bind(this);
        debug('props', this.props);
    }

    _onTerminal(term) {
        debug('OnTerminal')
        if (this.props && this.props.onTerminal) {
            this.props.onTerminal(term);
        }
        //this.config = evaluateConfig(Object.assign({}, defaultConfg, window.config.getConfig().hypernpm || {}));
        term.uninstallKeyboard();
        term.keyboard.handlers_ = [
            [ "keydown", keydownHandler(this.props.onMoveToPane, this.props.onSwitchWithActiveSession) ],
            ...term.keyboard.handlers_
        ];
        term.installKeyboard();
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
      return React.createElement(Term, Object.assign({}, this.props, {customChildrenBefore, onTerminal: this._onTerminal}));
    }
  }
}

