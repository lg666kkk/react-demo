/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                        
                                                 
                                                                            
                                                         
import {
  REACT_SERVER_CONTEXT_TYPE,
  REACT_MEMO_CACHE_SENTINEL,
} from 'shared/ReactSymbols';
import {readContext as readContextImpl} from './ReactFlightNewContext';
import {createThenableState, trackUsedThenable} from './ReactFlightThenable';
import {isClientReference} from './ReactFlightServerConfig';

let currentRequest = null;
let thenableIndexCounter = 0;
let thenableState = null;

export function prepareToUseHooksForRequest(request         ) {
  currentRequest = request;
}

export function resetHooksForRequest() {
  currentRequest = null;
}

export function prepareToUseHooksForComponent(
  prevThenableState                      ,
) {
  thenableIndexCounter = 0;
  thenableState = prevThenableState;
}

export function getThenableStateAfterSuspending()                       {
  const state = thenableState;
  thenableState = null;
  return state;
}

function readContext   (context                       )    {
  if (__DEV__) {
    if (context.$$typeof !== REACT_SERVER_CONTEXT_TYPE) {
      if (isClientReference(context)) {
        console.error('Cannot read a Client Context from a Server Component.');
      } else {
        console.error(
          'Only createServerContext is supported in Server Components.',
        );
      }
    }
    if (currentRequest === null) {
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

export const HooksDispatcher             = {
  useMemo   (nextCreate         )    {
    return nextCreate();
  },
  useCallback   (callback   )    {
    return callback;
  },
  useDebugValue()       {},
  useDeferredValue: (unsupportedHook     ),
  useTransition: (unsupportedHook     ),
  readContext,
  useContext: readContext,
  useReducer: (unsupportedHook     ),
  useRef: (unsupportedHook     ),
  useState: (unsupportedHook     ),
  useInsertionEffect: (unsupportedHook     ),
  useLayoutEffect: (unsupportedHook     ),
  useImperativeHandle: (unsupportedHook     ),
  useEffect: (unsupportedHook     ),
  useId,
  useMutableSource: (unsupportedHook     ),
  useSyncExternalStore: (unsupportedHook     ),
  useCacheRefresh()                            {
    return unsupportedRefresh;
  },
  useMemoCache(size        )             {
    const data = new Array     (size);
    for (let i = 0; i < size; i++) {
      data[i] = REACT_MEMO_CACHE_SENTINEL;
    }
    return data;
  },
  use,
};

function unsupportedHook()       {
  throw new Error('This Hook is not supported in Server Components.');
}

function unsupportedRefresh()       {
  throw new Error(
    'Refreshing the cache is not supported in Server Components.',
  );
}

function useId()         {
  if (currentRequest === null) {
    throw new Error('useId can only be used while React is rendering');
  }
  const id = currentRequest.identifierCount++;
  // use 'S' for Flight components to distinguish from 'R' and 'r' in Fizz/Client
  return ':' + currentRequest.identifierPrefix + 'S' + id.toString(32) + ':';
}

function use   (usable           )    {
  if (
    (usable !== null && typeof usable === 'object') ||
    typeof usable === 'function'
  ) {
    // $FlowFixMe[method-unbinding]
    if (typeof usable.then === 'function') {
      // This is a thenable.
      const thenable              = (usable     );

      // Track the position of the thenable within this fiber.
      const index = thenableIndexCounter;
      thenableIndexCounter += 1;

      if (thenableState === null) {
        thenableState = createThenableState();
      }
      return trackUsedThenable(thenableState, thenable, index);
    } else if (usable.$$typeof === REACT_SERVER_CONTEXT_TYPE) {
      const context                        = (usable     );
      return readContext(context);
    }
  }

  if (__DEV__) {
    if (isClientReference(usable)) {
      console.error('Cannot use() an already resolved Client Reference.');
    }
  }

  // eslint-disable-next-line react-internal/safe-string-coercion
  throw new Error('An unsupported type was passed to use(): ' + String(usable));
}
