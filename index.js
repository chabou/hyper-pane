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
      to: nextSessionUid
    });
  });
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
  return Object.assign({}, props, {sortedSessionGroups: sortedSessionGroups[uid]});//, onMoveToPane, onSwitchWithActiveSession});
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
  return Object.assign({}, props, {termShorcutNum});//, onMoveToPane, onSwitchWithActiveSession});
};

exports.mapTermsDispatch = (dispatch, map) => {
  map.onMoveToPane = onMoveToPane(dispatch);
  map.onSwitchWithActiveSession = onSwitchWithActiveSession(dispatch);
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
        let shortcut = `meta+alt+${num}`;
        debug('Add shortcut', shortcut);
        keys.bind(
          shortcut,
          (e) => {
            this.props.onMoveToPane(num);
            this.reattachKeyListner();
          }
        );
        shortcut = `meta+alt+ctrl+${num}`;
        debug('Add shortcut', shortcut);
        keys.bind(
          shortcut,
          (e) => {
            this.props.onSwitchWithActiveSession(num);
            this.reattachKeyListner();
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

