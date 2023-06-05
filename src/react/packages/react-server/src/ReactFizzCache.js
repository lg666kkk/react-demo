/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                                             

function getCacheSignal()              {
  throw new Error('Not implemented.');
}

function getCacheForType   (resourceType         )    {
  throw new Error('Not implemented.');
}

export const DefaultCacheDispatcher                  = {
  getCacheSignal,
  getCacheForType,
};
