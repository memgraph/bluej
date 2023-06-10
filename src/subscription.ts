import { Driver, Session } from 'neo4j-driver'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { Database } from './db'
const neo4j = require('neo4j-driver')

const verbose = false
const outputError = false

interface RetryableQuery {
  query: string;
  params: object;
  retryCount: number;
}

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  private driver: Driver;
  private queryQueue: RetryableQuery[];
  private intervalId?: NodeJS.Timeout;

  constructor(public db: Database, public service: string) {
    super(db, service)
    this.driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("", ""), { encrypted: 'ENCRYPTION_OFF' })
    this.queryQueue = [];
    this.intervalId = undefined;
    this.startProcessingQueue()
  }

  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    if (ops.posts.deletes.length > 0) {
      for (const post of ops.posts.deletes) {
        if (verbose) process.stdout.write('P')
        //process.stdout.write(util.inspect(post, false, null, true))
        try {
          await this.executeQuery("MATCH (p:Post {uri: $uri}) DETACH DELETE p", { uri: post.uri })
        } catch (err) {
          if (outputError) console.error('[ERROR POST DELETE]:', err)
        }
      }
    }

    if (ops.posts.creates.length > 0) {
      for (const post of ops.posts.creates) {
        if (verbose) process.stdout.write('p')
        await this.executeQuery("CREATE (post:Post {uri: $uri, cid: $cid, author: $author, text: $text, createdAt: $createdAt, indexedAt: LocalDateTime()}) MERGE (person:Person {did: $author}) MERGE (person)-[:AUTHOR_OF {weight: 0}]->(post)",
          { uri: post.uri, cid: post.cid, author: post.author, text: post.record.text, createdAt: post.record.createdAt })
        const replyRoot = post.record?.reply?.root ? post.record.reply.root.uri : null
        const replyParent = post.record?.reply?.parent ? post.record.reply.parent.uri : null
        if (replyRoot) {
          await this.executeQuery("MERGE (post1:Post {uri: $uri}) MERGE (post2:Post {uri: $rootUri}) MERGE (post1)-[:ROOT {weight: 0}]->(post2)", { uri: post.uri, rootUri: replyRoot })
        }
        if (replyParent) {
          await this.executeQuery("MERGE (post1:Post {uri: $uri}) MERGE (post2:Post {uri: $parentUri}) MERGE (post1)-[:PARENT {weight: 0}]->(post2)", { uri: post.uri, parentUri: replyParent })
        }
      }
    }

    if (ops.follows.deletes.length > 0) {
      for (const follow of ops.follows.deletes) {
        if (verbose) process.stdout.write('F')
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
        if (verbose) process.stdout.write('f')
        await this.executeQuery("MERGE (p1:Person {did: $authorDid}) MERGE (p2:Person {did: $subjectDid}) MERGE (p1)-[:FOLLOW {weight: 2}]->(p2)", { authorDid: follow.author, subjectDid: follow.record.subject })
      }
    }

    if (ops.likes.deletes.length > 0) {
      for (const like of ops.likes.deletes) {
        if (verbose) process.stdout.write('L')
        //FIXME sane situation as with follows.delete, just a URI and not a full source -> dest mapping
      }
    }

    if (ops.likes.creates.length > 0) {
      for (const like of ops.likes.creates) {
        if (verbose) process.stdout.write('l')
        await this.executeQuery("MERGE (person:Person {did: $authorDid}) MERGE (post:Post {uri: $postUri}) MERGE (person)-[:LIKE {weight: 1}]->(post)", { authorDid: like.author, postUri: like.record.subject.uri })
      }
    }

    if (ops.reposts.deletes.length > 0) {
      for (const repost of ops.reposts.deletes) {
        if (verbose) process.stdout.write('R')
        await this.executeQuery("MATCH (p:Post {uri: $uri}) DETACH DELETE p", { uri: repost.uri })
      }
    }

    if (ops.reposts.creates.length > 0) {
      for (const repost of ops.reposts.creates) {
        if (verbose) process.stdout.write('r')
        await this.executeQuery("CREATE (p:Post {uri: $uri, cid: $cid, author: $author, repostUri: $repostUri, createdAt: $createdAt, indexedAt: LocalDateTime()}) RETURN p", { uri: repost.uri, cid: repost.cid, author: repost.author, repostUri: repost.record.subject.uri, createdAt: repost.record.createdAt })
      }
    }
  }

  async executeQuery(query: string, params: object, retryCount: number = 10): Promise<void> {
    const session = this.driver.session()
    try {
      await session.run(query, params);
    } catch (error) {
      if (this.isRetryableError(error) && retryCount > 0) {
        this.queryQueue.push({ query, params: params, retryCount: retryCount - 1 })
        console.log('Query failed, retrying later: ', query)
      } else {
        let message = 'Unknown Error'
        if (error instanceof Error) message = error.message
        console.log('Query failed, giving up:', message, 'query: ', query)
      }
    } finally {
      session.close()
    }
  }

  private isRetryableError(error: any): boolean {
    // look at the exception isRetryable ?
    return true;
  }

  async processQueryQueue(): Promise<void> {
    const queueLength = this.queryQueue.length;
    for (let i = 0; i < queueLength; i++) {
      const { query, params, retryCount } = this.queryQueue.shift()!;
      this.executeQuery(query, params, retryCount);
    }
  }

  startProcessingQueue(intervalSeconds: number = 5): void {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        this.processQueryQueue();
      }, intervalSeconds * 1000);
    }
  }

  stopProcessingQueue(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
