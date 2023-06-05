/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                             

import {resolveRequest, getCache} from '../ReactFlightServer';

function createSignal()              {
  return new AbortController().signal;
}

function resolveCache()                       {
  const request = resolveRequest();
  if (request) {
    return getCache(request);
  }
  return new Map();
}

export const DefaultCacheDispatcher                  = {
  getCacheSignal()              {
    const cache = resolveCache();
    let entry                     = (cache.get(createSignal)     );
    if (entry === undefined) {
      entry = createSignal();
      cache.set(createSignal, entry);
    }
    return entry;
  },
  getCacheForType   (resourceType         )    {
    const cache = resolveCache();
    let entry           = (cache.get(resourceType)     );
    if (entry === undefined) {
      entry = resourceType();
      // TODO: Warn if undefined?
      cache.set(resourceType, entry);
    }
    return entry;
  },
};
