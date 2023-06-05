/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                        

             
                
                             
                           
               
                         
           
         
                           

                                                     
                                            
                                                       
                                                        

import {readContext as readContextImpl} from './ReactFizzNewContext';
import {getTreeId} from './ReactFizzTreeContext';
import {createThenableState, trackUsedThenable} from './ReactFizzThenable';

import {makeId, NotPendingTransition} from './ReactFizzConfig';

import {
  enableCache,
  enableUseEffectEventHook,
  enableUseMemoCacheHook,
  enableAsyncActions,
  enableFormActions,
} from 'shared/ReactFeatureFlags';
import is from 'shared/objectIs';
import {
  REACT_SERVER_CONTEXT_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_MEMO_CACHE_SENTINEL,
} from 'shared/ReactSymbols';

                                        
                             

                  
            
                         
  

                       
                         
                
  

             
                     
                                 
                    
  

let currentlyRenderingComponent                = null;
let currentlyRenderingTask              = null;
let firstWorkInProgressHook              = null;
let workInProgressHook              = null;
// Whether the work-in-progress hook is a re-rendered hook
let isReRender          = false;
// Whether an update was scheduled during the currently executing render pass.
let didScheduleRenderPhaseUpdate          = false;
// Counts the number of useId hooks in this component
let localIdCounter         = 0;
// Counts the number of use(thenable) calls in this component
let thenableIndexCounter         = 0;
let thenableState                       = null;
// Lazily created map of render-phase updates
let renderPhaseUpdates                                            = null;
// Counter to prevent infinite loops.
let numberOfReRenders         = 0;
const RE_RENDER_LIMIT = 25;

let isInHookUserCodeInDev = false;

// In DEV, this is the name of the currently executing primitive hook
let currentHookNameInDev         ;

function resolveCurrentlyRenderingComponent()         {
  if (currentlyRenderingComponent === null) {
    throw new Error(
      'Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' +
        ' one of the following reasons:\n' +
        '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' +
        '2. You might be breaking the Rules of Hooks\n' +
        '3. You might have more than one copy of React in the same app\n' +
        'See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.',
    );
  }

  if (__DEV__) {
    if (isInHookUserCodeInDev) {
      console.error(
        'Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks. ' +
          'You can only call Hooks at the top level of your React function. ' +
          'For more information, see ' +
          'https://reactjs.org/link/rules-of-hooks',
      );
    }
  }
  return currentlyRenderingComponent;
}

function areHookInputsEqual(
  nextDeps              ,
  prevDeps                     ,
) {
  if (prevDeps === null) {
    if (__DEV__) {
      console.error(
        '%s received a final argument during this render, but not during ' +
          'the previous render. Even though the final argument is optional, ' +
          'its type cannot change between renders.',
        currentHookNameInDev,
      );
    }
    return false;
  }

  if (__DEV__) {
    // Don't bother comparing lengths in prod because these arrays should be
    // passed inline.
    if (nextDeps.length !== prevDeps.length) {
      console.error(
        'The final argument passed to %s changed size between renders. The ' +
          'order and size of this array must remain constant.\n\n' +
          'Previous: %s\n' +
          'Incoming: %s',
        currentHookNameInDev,
        `[${nextDeps.join(', ')}]`,
        `[${prevDeps.join(', ')}]`,
      );
    }
  }
  // $FlowFixMe[incompatible-use] found when upgrading Flow
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    if (is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function createHook()       {
  if (numberOfReRenders > 0) {
    throw new Error('Rendered more hooks than during the previous render');
  }
  return {
    memoizedState: null,
    queue: null,
    next: null,
  };
}

function createWorkInProgressHook()       {
  if (workInProgressHook === null) {
    // This is the first hook in the list
    if (firstWorkInProgressHook === null) {
      isReRender = false;
      firstWorkInProgressHook = workInProgressHook = createHook();
    } else {
      // There's already a work-in-progress. Reuse it.
      isReRender = true;
      workInProgressHook = firstWorkInProgressHook;
    }
  } else {
    if (workInProgressHook.next === null) {
      isReRender = false;
      // Append to the end of the list
      workInProgressHook = workInProgressHook.next = createHook();
    } else {
      // There's already a work-in-progress. Reuse it.
      isReRender = true;
      workInProgressHook = workInProgressHook.next;
    }
  }
  return workInProgressHook;
}

export function prepareToUseHooks(
  task      ,
  componentIdentity        ,
  prevThenableState                      ,
)       {
  currentlyRenderingComponent = componentIdentity;
  currentlyRenderingTask = task;
  if (__DEV__) {
    isInHookUserCodeInDev = false;
  }

  // The following should have already been reset
  // didScheduleRenderPhaseUpdate = false;
  // firstWorkInProgressHook = null;
  // numberOfReRenders = 0;
  // renderPhaseUpdates = null;
  // workInProgressHook = null;

  localIdCounter = 0;
  thenableIndexCounter = 0;
  thenableState = prevThenableState;
}

export function finishHooks(
  Component     ,
  props     ,
  children     ,
  refOrContext     ,
)      {
  // This must be called after every function component to prevent hooks from
  // being used in classes.

  while (didScheduleRenderPhaseUpdate) {
    // Updates were scheduled during the render phase. They are stored in
    // the `renderPhaseUpdates` map. Call the component again, reusing the
    // work-in-progress hooks and applying the additional updates on top. Keep
    // restarting until no more updates are scheduled.
    didScheduleRenderPhaseUpdate = false;
    localIdCounter = 0;
    thenableIndexCounter = 0;
    numberOfReRenders += 1;

    // Start over from the beginning of the list
    workInProgressHook = null;

    children = Component(props, refOrContext);
  }
  resetHooksState();
  return children;
}

export function getThenableStateAfterSuspending()                       {
  const state = thenableState;
  thenableState = null;
  return state;
}

export function checkDidRenderIdHook()          {
  // This should be called immediately after every finishHooks call.
  // Conceptually, it's part of the return value of finishHooks; it's only a
  // separate function to avoid using an array tuple.
  const didRenderIdHook = localIdCounter !== 0;
  return didRenderIdHook;
}

// Reset the internal hooks state if an error occurs while rendering a component
export function resetHooksState()       {
  if (__DEV__) {
    isInHookUserCodeInDev = false;
  }

  currentlyRenderingComponent = null;
  currentlyRenderingTask = null;
  didScheduleRenderPhaseUpdate = false;
  firstWorkInProgressHook = null;
  numberOfReRenders = 0;
  renderPhaseUpdates = null;
  workInProgressHook = null;
}

function readContext   (context                 )    {
  if (__DEV__) {
    if (isInHookUserCodeInDev) {
      console.error(
        'Context can only be read while React is rendering. ' +
          'In classes, you can read it in the render method or getDerivedStateFromProps. ' +
          'In function components, you can read it directly in the function body, but not ' +
          'inside Hooks like useReducer() or useMemo().',
      );
    }
  }
  return readContextImpl(context);
}

function useContext   (context                 )    {
  if (__DEV__) {
    currentHookNameInDev = 'useContext';
  }
  resolveCurrentlyRenderingComponent();
  return readContextImpl(context);
}

function basicStateReducer   (state   , action                     )    {
  // $FlowFixMe[incompatible-use]: Flow doesn't like mixed types
  return typeof action === 'function' ? action(state) : action;
}

export function useState   (
  initialState               ,
)                                     {
  if (__DEV__) {
    currentHookNameInDev = 'useState';
  }
  return useReducer(
    basicStateReducer,
    // useReducer has a special case to support lazy useState initializers
    (initialState     ),
  );
}

export function useReducer         (
  reducer             ,
  initialArg   ,
  init         ,
)                   {
  if (__DEV__) {
    if (reducer !== basicStateReducer) {
      currentHookNameInDev = 'useReducer';
    }
  }
  currentlyRenderingComponent = resolveCurrentlyRenderingComponent();
  workInProgressHook = createWorkInProgressHook();
  if (isReRender) {
    // This is a re-render. Apply the new render phase updates to the previous
    // current hook.
    const queue                 = (workInProgressHook.queue     );
    const dispatch              = (queue.dispatch     );
    if (renderPhaseUpdates !== null) {
      // Render phase updates are stored in a map of queue -> linked list
      const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue);
      if (firstRenderPhaseUpdate !== undefined) {
        // $FlowFixMe[incompatible-use] found when upgrading Flow
        renderPhaseUpdates.delete(queue);
        // $FlowFixMe[incompatible-use] found when upgrading Flow
        let newState = workInProgressHook.memoizedState;
        let update              = firstRenderPhaseUpdate;
        do {
          // Process this render phase update. We don't have to check the
          // priority because it will always be the same as the current
          // render's.
          const action = update.action;
          if (__DEV__) {
            isInHookUserCodeInDev = true;
          }
          newState = reducer(newState, action);
          if (__DEV__) {
            isInHookUserCodeInDev = false;
          }
          // $FlowFixMe[incompatible-type] we bail out when we get a null
          update = update.next;
        } while (update !== null);

        // $FlowFixMe[incompatible-use] found when upgrading Flow
        workInProgressHook.memoizedState = newState;

        return [newState, dispatch];
      }
    }
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    return [workInProgressHook.memoizedState, dispatch];
  } else {
    if (__DEV__) {
      isInHookUserCodeInDev = true;
    }
    let initialState;
    if (reducer === basicStateReducer) {
      // Special case for `useState`.
      initialState =
        typeof initialArg === 'function'
          ? ((initialArg     )         )()
          : ((initialArg     )   );
    } else {
      initialState =
        init !== undefined ? init(initialArg) : ((initialArg     )   );
    }
    if (__DEV__) {
      isInHookUserCodeInDev = false;
    }
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    workInProgressHook.memoizedState = initialState;
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    const queue                 = (workInProgressHook.queue = {
      last: null,
      dispatch: null,
    });
    const dispatch              = (queue.dispatch = (dispatchAction.bind(
      null,
      currentlyRenderingComponent,
      queue,
    )     ));
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    return [workInProgressHook.memoizedState, dispatch];
  }
}

function useMemo   (nextCreate         , deps                            )    {
  currentlyRenderingComponent = resolveCurrentlyRenderingComponent();
  workInProgressHook = createWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;

  if (workInProgressHook !== null) {
    const prevState = workInProgressHook.memoizedState;
    if (prevState !== null) {
      if (nextDeps !== null) {
        const prevDeps = prevState[1];
        if (areHookInputsEqual(nextDeps, prevDeps)) {
          return prevState[0];
        }
      }
    }
  }

  if (__DEV__) {
    isInHookUserCodeInDev = true;
  }
  const nextValue = nextCreate();
  if (__DEV__) {
    isInHookUserCodeInDev = false;
  }
  // $FlowFixMe[incompatible-use] found when upgrading Flow
  workInProgressHook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function useRef   (initialValue   )               {
  currentlyRenderingComponent = resolveCurrentlyRenderingComponent();
  workInProgressHook = createWorkInProgressHook();
  const previousRef = workInProgressHook.memoizedState;
  if (previousRef === null) {
    const ref = {current: initialValue};
    if (__DEV__) {
      Object.seal(ref);
    }
    // $FlowFixMe[incompatible-use] found when upgrading Flow
    workInProgressHook.memoizedState = ref;
    return ref;
  } else {
    return previousRef;
  }
}

function dispatchAction   (
  componentIdentity        ,
  queue                ,
  action   ,
)       {
  if (numberOfReRenders >= RE_RENDER_LIMIT) {
    throw new Error(
      'Too many re-renders. React limits the number of renders to prevent ' +
        'an infinite loop.',
    );
  }

  if (componentIdentity === currentlyRenderingComponent) {
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    didScheduleRenderPhaseUpdate = true;
    const update            = {
      action,
      next: null,
    };
    if (renderPhaseUpdates === null) {
      renderPhaseUpdates = new Map();
    }
    const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue);
    if (firstRenderPhaseUpdate === undefined) {
      // $FlowFixMe[incompatible-use] found when upgrading Flow
      renderPhaseUpdates.set(queue, update);
    } else {
      // Append the update to the end of the list.
      let lastRenderPhaseUpdate = firstRenderPhaseUpdate;
      while (lastRenderPhaseUpdate.next !== null) {
        lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
      }
      lastRenderPhaseUpdate.next = update;
    }
  } else {
    // This means an update has happened after the function component has
    // returned. On the server this is a no-op. In React Fiber, the update
    // would be scheduled for a future render.
  }
}

export function useCallback   (
  callback   ,
  deps                            ,
)    {
  return useMemo(() => callback, deps);
}

function throwOnUseEffectEventCall() {
  throw new Error(
    "A function wrapped in useEffectEvent can't be called during rendering.",
  );
}

export function useEffectEvent                                             (
  callback   ,
)    {
  // $FlowIgnore[incompatible-return]
  return throwOnUseEffectEventCall;
}

// TODO Decide on how to implement this hook for server rendering.
// If a mutation occurs during render, consider triggering a Suspense boundary
// and falling back to client rendering.
function useMutableSource                  (
  source                       ,
  getSnapshot                                              ,
  subscribe                                            ,
)           {
  resolveCurrentlyRenderingComponent();
  return getSnapshot(source._source);
}

function useSyncExternalStore   (
  subscribe                            ,
  getSnapshot         ,
  getServerSnapshot          ,
)    {
  if (getServerSnapshot === undefined) {
    throw new Error(
      'Missing getServerSnapshot, which is required for ' +
        'server-rendered content. Will revert to client rendering.',
    );
  }
  return getServerSnapshot();
}

function useDeferredValue   (value   )    {
  resolveCurrentlyRenderingComponent();
  return value;
}

function unsupportedStartTransition() {
  throw new Error('startTransition cannot be called during server rendering.');
}

function useTransition()   
          
                                                                   
  {
  resolveCurrentlyRenderingComponent();
  return [false, unsupportedStartTransition];
}

function useHostTransitionStatus()                   {
  resolveCurrentlyRenderingComponent();
  return NotPendingTransition;
}

function unsupportedSetOptimisticState() {
  throw new Error('Cannot update optimistic state while rendering.');
}

function useOptimistic      (
  passthrough   ,
  reducer              ,
)                   {
  resolveCurrentlyRenderingComponent();
  return [passthrough, unsupportedSetOptimisticState];
}

function useId()         {
  const task       = (currentlyRenderingTask     );
  const treeId = getTreeId(task.treeContext);

  const responseState = currentResponseState;
  if (responseState === null) {
    throw new Error(
      'Invalid hook call. Hooks can only be called inside of the body of a function component.',
    );
  }

  const localId = localIdCounter++;
  return makeId(responseState, treeId, localId);
}

function use   (usable           )    {
  if (usable !== null && typeof usable === 'object') {
    // $FlowFixMe[method-unbinding]
    if (typeof usable.then === 'function') {
      // This is a thenable.
      const thenable              = (usable     );
      return unwrapThenable(thenable);
    } else if (
      usable.$$typeof === REACT_CONTEXT_TYPE ||
      usable.$$typeof === REACT_SERVER_CONTEXT_TYPE
    ) {
      const context                  = (usable     );
      return readContext(context);
    }
  }

  // eslint-disable-next-line react-internal/safe-string-coercion
  throw new Error('An unsupported type was passed to use(): ' + String(usable));
}

export function unwrapThenable   (thenable             )    {
  const index = thenableIndexCounter;
  thenableIndexCounter += 1;
  if (thenableState === null) {
    thenableState = createThenableState();
  }
  return trackUsedThenable(thenableState, thenable, index);
}

function unsupportedRefresh() {
  throw new Error('Cache cannot be refreshed during server rendering.');
}

function useCacheRefresh()                            {
  return unsupportedRefresh;
}

function useMemoCache(size        )             {
  const data = new Array     (size);
  for (let i = 0; i < size; i++) {
    data[i] = REACT_MEMO_CACHE_SENTINEL;
  }
  return data;
}

function noop()       {}

export const HooksDispatcher             = {
  readContext,
  use,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  useInsertionEffect: noop,
  useLayoutEffect: noop,
  useCallback,
  // useImperativeHandle is not run in the server environment
  useImperativeHandle: noop,
  // Effects are not run in the server environment.
  useEffect: noop,
  // Debugging effect
  useDebugValue: noop,
  useDeferredValue,
  useTransition,
  useId,
  // Subscriptions are not setup in a server environment.
  useMutableSource,
  useSyncExternalStore,
};

if (enableCache) {
  HooksDispatcher.useCacheRefresh = useCacheRefresh;
}
if (enableUseEffectEventHook) {
  HooksDispatcher.useEffectEvent = useEffectEvent;
}
if (enableUseMemoCacheHook) {
  HooksDispatcher.useMemoCache = useMemoCache;
}
if (enableFormActions && enableAsyncActions) {
  HooksDispatcher.useHostTransitionStatus = useHostTransitionStatus;
}
if (enableAsyncActions) {
  HooksDispatcher.useOptimistic = useOptimistic;
}

export let currentResponseState                       = (null     );
export function setCurrentResponseState(
  responseState                      ,
)       {
  currentResponseState = responseState;
}
