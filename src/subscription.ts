import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
const neo4j = require('neo4j-driver')
const util = require('util')
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })
const session = driver.session()

async () => {
  await session.run("CREATE INDEX ON :Person(did)", {})
  await session.run("CREATE INDEX ON :Post(uri)", {})
}

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    if (ops.posts.deletes.length > 0) {
      for (const post of ops.posts.deletes) {
        process.stdout.write('P')
        //process.stdout.write(util.inspect(post, false, null, true))
        try {
          await session.run("MATCH (p:Post {uri: $uri}) DETACH DELETE p", { uri: post.uri })
        } catch (err) {
          console.error('[ERROR POST DELETE]:', err)
        }
      }
    }

    if (ops.posts.creates.length > 0) {
      for (const post of ops.posts.creates) {
        process.stdout.write('p')
        //process.stdout.write(util.inspect(post, false, null, true))
        try {
          await session.run("CREATE (p:Post {uri: $uri, cid: $cid, author: $author, text: $text, createdAt: $createdAt}) RETURN p", { uri: post.uri, cid: post.cid, author: post.author, text: post.record.text, createdAt: post.record.createdAt })
          await session.run("CREATE a = (:Person {did: $did})-[:AUTHOR_OF]->(:Post {uri: $postUri}) RETURN a", { postUri: post.uri, did: post.author})
          await session.run("CREATE a = (:Post {uri: $postUri})-[:AUTHOR]->(:Person {did: $did}) RETURN a", { postUri: post.uri, did: post.author })
          
          const replyRoot = post.record?.reply?.root ? post.record.reply.root.uri : null
          const replyParent = post.record?.reply?.parent ? post.record.reply.parent.uri : null
          if (replyRoot) {
            await session.run("CREATE r = (:Post {uri: $uri})-[:ROOT]->(:Post {uri: $rootUri}) RETURN r", { uri: post.uri, rootUri: replyRoot })
          }
          if (replyParent) {
            await session.run("CREATE r = (:Post {uri: $uri})-[:PARENT]->(:Post {uri: $parentUri}) RETURN r", { uri: post.uri, parentUri: replyParent })
          }
        } catch (err) {
          console.error('[ERROR POST CREATE]:', err)
        }
      }
    }

    if (ops.follows.deletes.length > 0) {
      for (const follow of ops.follows.deletes) {
        process.stdout.write('F')
        //FIXME the record only contains a URI without a source -> dest DID mapping. There is a URI in the at:// uri, but no destination is specificed
        // So not sure yet how to delete the follow relationship in a graph 
        //{
        //  uri: 'at://did:plc:oftvwqwimefeuzes4nwinubh/app.bsky.graph.follow/3jvcsau7em22q'
        //}
        //process.stdout.write(util.inspect(follow, false, null, true))
      }
    }

    if (ops.follows.creates.length > 0) {
      for (const follow of ops.follows.creates) {
        process.stdout.write('f')
        //process.stdout.write(util.inspect(follow, false, null, true))
        try {
          await session.run("CREATE f = (:Person {did: $authorDid})-[:FOLLOW]->(:Person {did: $subjectDid}) RETURN f", { authorDid: follow.author, subjectDid: follow.record.subject })
        } catch (err) {
          console.error('[ERROR POST CREATE]:', err)
        }
      }
    }

    if (ops.likes.deletes.length > 0) {
      for (const like of ops.likes.deletes) {
        process.stdout.write('L')
        //FIXME sane situation as with follows.delete, just a URI and not a full source -> dest mapping
        //process.stdout.write(util.inspect(like, false, null, true))
      }
    }

    if (ops.likes.creates.length > 0) {
      for (const like of ops.likes.creates) {
        process.stdout.write('l')
        //process.stdout.write(util.inspect(like, false, null, true))
        try {
          await session.run("CREATE l = (:Person {did: $authorDid})-[:LIKE]->(:Post {uri: $postUri}) RETURN l", { authorDid: like.author, postUri: like.record.subject.uri })
        } catch (err) {
          console.error('[ERROR POST CREATE]:', err)
        }

      }
    }

    if (ops.reposts.deletes.length > 0) {
      for (const repost of ops.reposts.deletes) {
        process.stdout.write('R')
        //process.stdout.write(util.inspect(repost, false, null, true))
        try {
          await session.run("MATCH (p:Post {uri: $uri}) DETACH DELETE p", { uri: repost.uri })
        } catch (err) {
          console.error('[ERROR REPOST DELETE]:', err)
        }
      }
    }

    if (ops.reposts.creates.length > 0) {
      for (const repost of ops.reposts.creates) {
        process.stdout.write('r')
        //process.stdout.write(util.inspect(repost, false, null, true))
        try {
          await session.run("CREATE (p:Post {uri: $uri, cid: $cid, author: $author, repostUri: $repostUri, createdAt: $createdAt}) RETURN p", { uri: repost.uri, cid: repost.cid, author: repost.author, repostUri: repost.record.subject.uri, createdAt: repost.record.createdAt })
        } catch (err) {
          console.error('[ERROR REPOST CREATE]:', err)
        }
      }
    }
  }
}
