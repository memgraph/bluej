// Queries used by BlueJ that implement thex various algorithms for fetching posts from the graph.

export const followQuery =
    'MATCH (my_person:Person {did: $did})-[:FOLLOW]->(follow_person:Person) ' +
    'MATCH(follow_person) - [: AUTHOR_OF] -> (post:Post) ' +
    'WHERE post.indexedAt IS NOT NULL WHERE_POST_NODE_ID ' +
    'WITH localDateTime() - post.indexedAt as duration, post ' +
    'WHERE duration.day < 5 ' +
    'WITH(duration.day * 24) + duration.hour as hour_age, post ' +
    'MATCH(: Person) - [l: LIKE] -> (post) ' +
    'WITH count(l) as likes, hour_age, post ' +
    'RETURN ID(post), post.uri, hour_age, likes, 1 as score ' +
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
    'with (ceil(likes) / ceil(1 + (hour_age * hour_age * hour_age * hour_age))) as score, likes, hour_age, post ' +
    'RETURN ID(post), post.uri, hour_age, likes, score ' +
    'ORDER BY score DESC, hour_age ASC, post.indexedAt DESC ' +
    'LIMIT '


export const likedByFollowQuery = 
    'MATCH (my_person:Person {did: $did})-[:FOLLOW]->(follow_person:Person) ' +
    'MATCH(follow_person) - [: LIKE] -> (post:Post) ' +
    'WHERE post.indexedAt IS NOT NULL AND NOT exists((post) - [: ROOT] -> (: Post)) WHERE_POST_NODE_ID ' +
    'WITH localDateTime() - post.indexedAt as duration, post, follow_person ' +
    'WHERE duration.day < 5 ' +
    'WITH(duration.day * 24) + duration.hour as hour_age, post, follow_person ' +
    'ORDER BY post.indexedAt DESC ' +
    'LIMIT 500 ' +
    'MATCH(: Person) - [l: LIKE] -> (post) ' +
    'WITH count(l) as likes, hour_age, post, follow_person ' +
    'WITH(ceil(likes) / ceil(1 + (hour_age * hour_age * hour_age * hour_age))) as score, likes, hour_age, post, follow_person ' +
    'RETURN ID(post), post.uri, hour_age, likes, score, follow_person ' +
    'ORDER BY score DESC, hour_age ASC, post.indexedAt DESC ' +
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
    'with (ceil(likes) / ceil(1 + (hour_age * hour_age * hour_age * hour_age))) as score, likes, hour_age, post ' +
    'RETURN ID(post), post.uri, hour_age, likes, score ' +
    'ORDER BY score DESC, hour_age ASC, post.indexedAt DESC ' +
    'LIMIT '
