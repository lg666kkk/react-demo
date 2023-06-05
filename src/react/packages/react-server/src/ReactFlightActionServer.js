/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                

             
                 
                                     
                                                  

import {
  resolveServerReference,
  preloadModule,
  requireModule,
} from 'react-client/src/ReactFlightClientConfig';

import {createResponse, close, getRoot} from './ReactFlightReplyServer';

                             

function bindArgs(fn     , args     ) {
  return fn.bind.apply(fn, [null].concat(args));
}

function loadServerReference   (
  bundlerConfig                ,
  id                   ,
  bound                             ,
)             {
  const serverReference                     =
    resolveServerReference            (bundlerConfig, id);
  // We expect most servers to not really need this because you'd just have all
  // the relevant modules already loaded but it allows for lazy loading of code
  // if needed.
  const preloadPromise = preloadModule(serverReference);
  if (bound) {
    return Promise.all([(bound     ), preloadPromise]).then(
      ([args]            ) => bindArgs(requireModule(serverReference), args),
    );
  } else if (preloadPromise) {
    return Promise.resolve(preloadPromise).then(() =>
      requireModule(serverReference),
    );
  } else {
    // Synchronously available
    return Promise.resolve(requireModule(serverReference));
  }
}

export function decodeAction   (
  body          ,
  serverManifest                ,
)                          {
  // We're going to create a new formData object that holds all the fields except
  // the implementation details of the action data.
  const formData = new FormData();

  let action                                            = null;

  // $FlowFixMe[prop-missing]
  body.forEach((value               , key        ) => {
    if (!key.startsWith('$ACTION_')) {
      formData.append(key, value);
      return;
    }
    // Later actions may override earlier actions if a button is used to override the default
    // form action.
    if (key.startsWith('$ACTION_REF_')) {
      const formFieldPrefix = '$ACTION_' + key.slice(12) + ':';
      // The data for this reference is encoded in multiple fields under this prefix.
      const actionResponse = createResponse(
        serverManifest,
        formFieldPrefix,
        body,
      );
      close(actionResponse);
      const refPromise = getRoot  
                              
                                          
        (actionResponse);
      // Force it to initialize
      // $FlowFixMe
      refPromise.then(() => {});
      if (refPromise.status !== 'fulfilled') {
        // $FlowFixMe
        throw refPromise.reason;
      }
      const metaData = refPromise.value;
      action = loadServerReference(serverManifest, metaData.id, metaData.bound);
      return;
    }
    if (key.startsWith('$ACTION_ID_')) {
      const id = key.slice(11);
      action = loadServerReference(serverManifest, id, null);
      return;
    }
  });

  if (action === null) {
    return null;
  }
  // Return the action with the remaining FormData bound to the first argument.
  return action.then(fn => fn.bind(null, formData));
}
