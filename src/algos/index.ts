import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as FriendsAndCommunity from './friends-and-community'
import * as HomePlus from './home-plus'
import * as Authors from './authors'

type AlgoHandler = (ctx: AppContext, params: QueryParams, requesterDid: string) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [FriendsAndCommunity.uri]: FriendsAndCommunity.handler,
  [HomePlus.uri]: HomePlus.handler,
  [Authors.uri]: Authors.handler,
}

export default algos
