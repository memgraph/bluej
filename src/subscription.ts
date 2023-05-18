import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
var neo4j = require('neo4j-driver')

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)
    const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })
    const session = driver.session()

/*
[follow delete]
{
  uri: 'at://did:plc:oftvwqwimefeuzes4nwinubh/app.bsky.graph.follow/3jvcsau7em22q'
}

[follow create]
{
  record: {
    '$type': 'app.bsky.graph.follow',
    subject: 'did:plc:nkz2qw7c47td7lw542jtn6tu',
    createdAt: '2023-05-18T10:53:47.530Z'
  },
  uri: 'at://did:plc:4bes3fnl6ngecjyt3ky43236/app.bsky.graph.follow/3jvyqjbxok32l',
  cid: 'bafyreihmq25edax2jsq7b7dmzwk54juhnbaroswvczt3bspcsfq7fedyuq',
  author: 'did:plc:4bes3fnl6ngecjyt3ky43236'
}

[post delete]
at://did:plc:37s5sfi4ln4hzn5rgc7egboy/app.bsky.feed.post/3jvxpjb3mc32g

[post create]
{
  record: {
    text: 'Obrigado lindo 🤓',
    '$type': 'app.bsky.feed.post',
    reply: { root: [Object], parent: [Object] },
    createdAt: '2023-05-18T10:51:30.874Z'
  },
  uri: 'at://did:plc:exphjormp2sojr26gagp6v4f/app.bsky.feed.post/3jvyqf7gvct2g',
  cid: 'bafyreieiptaezvbowxjujujhqqf5kpp57oufumf65vwsa7x7zyls3gktxm',
  author: 'did:plc:exphjormp2sojr26gagp6v4f'
}

[like delete]
{
  uri: 'at://did:plc:qxwxmbcgzs3jxo7xsmh5nlwj/app.bsky.feed.like/3jvyqkg4k362f'
}

[like create]
{
  record: {
    '$type': 'app.bsky.feed.like',
    subject: {
      cid: 'bafyreia7r2nn7wbeyfaiowu3x3zbiundjn3tlgevvkvmhol7bwdnfkr4yi',
      uri: 'at://did:plc:llccg573ujhlnt7ulk3wiyzt/app.bsky.feed.post/3jvyqeszkhs2l'
    },
    createdAt: '2023-05-18T10:51:30.260Z'
  },
  uri: 'at://did:plc:s4vvu2hmagegff4z3wpy4xxp/app.bsky.feed.like/3jvyqf6w7532g',
  cid: 'bafyreiakm7nkrmgdio7loxj7nkcrayso3dpjtsxkdkjqw7omna2hpdhw54',
  author: 'did:plc:s4vvu2hmagegff4z3wpy4xxp'
}

[repost delete]
{
  uri: 'at://did:plc:xydmw4rhlnb4mrz5eyw3z6ak/app.bsky.feed.repost/3jvyqkptvwt2g'
}

[repost create]
{
  record: {
    '$type': 'app.bsky.feed.repost',
    subject: {
      cid: 'bafyreiapagaipbf4sflechnws62n4reyj3hikczt6pu5cj6w3oi5bywpwe',
      uri: 'at://did:plc:zplbw4hvwrkp6fqopwe2inod/app.bsky.feed.post/3jvyqanedew2f'
    },
    createdAt: '2023-05-18T10:52:39.573Z'
  },
  uri: 'at://did:plc:izm3fauw3hx4pspgzc5i76ht/app.bsky.feed.repost/3jvyqhayjdk2l',
  cid: 'bafyreibf3mbzpokmjbpcrjnjakzjvivbw4l45yph5lqgszwhghqltatrzu',
  author: 'did:plc:izm3fauw3hx4pspgzc5i76ht'
}



*/



    if (ops.posts.deletes.length > 0) {
      for (const post of ops.posts.deletes) {
        console.log('[post delete]')
        console.log(post.uri)
      }
    }

    if (ops.posts.creates.length > 0) {
      for (const post of ops.posts.creates) {
        console.log('[post create]')
        console.log(post)
      }
    }

    if (ops.follows.deletes.length > 0) {
      for (const follow of ops.follows.deletes) {
        console.log('[follow delete]')
        console.log(follow)
      }
    }

    if (ops.follows.creates.length > 0) {
      for (const follow of ops.follows.creates) {
        console.log('[follow create]')
        console.log(follow)
      }
    }

    if (ops.likes.deletes.length > 0) {
      for (const like of ops.likes.deletes) {
        console.log('[like delete]')
        console.log(like)
      }
    }

    if (ops.likes.creates.length > 0) {
      for (const like of ops.likes.creates) {
        console.log('[like create]')
        console.log(like)
      }
    }

    if (ops.reposts.deletes.length > 0) {
      for (const repost of ops.reposts.deletes) {
        console.log('[repost delete]')
        console.log(repost)
      }
    }

    if (ops.reposts.creates.length > 0) {
      for (const repost of ops.reposts.creates) {
        console.log('[repost create]')
        console.log(repost)
      }
    }
    /*
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        // only alf-related posts
        return create.record.text.toLowerCase().includes('alf')
      })
      .map((create) => {
        // map alf-related posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
    */
  }
}
