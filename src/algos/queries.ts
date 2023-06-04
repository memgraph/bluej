// Queries used by BlueJ for the various algorithms for fetching posts from the graph.

export const followQuery =
    'MATCH (my_person:Person {did: $did})-[:FOLLOW]->(follow_person:Person) ' +
    'MATCH(follow_person) - [: AUTHOR_OF] -> (post:Post) ' +
    'WHERE post.indexedAt IS NOT NULL WHERE_POST_NODE_ID ' +
    'RETURN post ' +
    'ORDER BY post.indexedAt DESC ' +
    'LIMIT '


export const topFollowQuery = 
    'MATCH (my_person:Person {did: $did})-[:FOLLOW]->(follow_person:Person) ' +
    'MATCH(follow_person) - [: AUTHOR_OF] -> (post: Post) ' +
    'WHERE post.indexedAt IS NOT NULL AND NOT exists((post) - [: ROOT] -> (: Post)) WHERE_POST_NODE_ID ' +
    'WITH localDateTime() - post.indexedAt as duration, post ' +
    'WHERE duration.day < 5 ' +
    'WITH(duration.day * 24) + duration.hour as hour_age, post ' +
    'MATCH(: Person) - [l: LIKE] -> (post) ' +
    'WITH count(l) as likes, hour_age, post ' +
    'CALL bluej.hacker_news(likes, hour_age, 4.2) YIELD score ' +
    'RETURN ID(post), post.uri, hour_age, likes, score ' +
    'ORDER BY score DESC, hour_age ASC ' +
    'LIMIT '


export const communityQuery =
    'MATCH(my_person: Person { did: $did }), (other_person: Person) ' +
    'WHERE other_person.did != my_person.did AND other_person.community_id = my_person.community_id ' +
    'MATCH(other_person) - [: AUTHOR_OF] -> (post:Post) ' +
    'WHERE post.indexedAt IS NOT NULL AND NOT exists((post) - [: ROOT] -> (: Post)) WHERE_POST_NODE_ID ' +
    'WITH localDateTime() - post.indexedAt as duration, post ' +
    'WHERE duration.day < 5 ' +
    'WITH(duration.day * 24) + duration.hour as hour_age, post ' +
    'MATCH(:Person) - [l: LIKE] -> (post) ' +
    'WITH count(l) as likes, hour_age, post ' +
    'CALL bluej.hacker_news(likes, hour_age, 4.2) YIELD score ' +
    'RETURN ID(post), post.uri, hour_age, likes, score ' +
    'ORDER BY score DESC, hour_age ASC ' +
    'LIMIT '
