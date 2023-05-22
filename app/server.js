const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const neo4j = require('neo4j-driver')

const runQuery = async (query, metadata = {}) => {
  const driver = neo4j.driver(
    'bolt://localhost',
    neo4j.auth.basic('', '')
  );
  const params = {};

  const session = driver.session()
  const results = await session.run(query, params, { metadata });
  // console.log(results);

  await session.close();
  await driver.close()
  return results;
}

const defaultId = 'did:plc:ewgejell4547pukut5255ibm';

/**
 * Get popularity score from people I follow by number of likes and comments.
 * 
 * @param {id} id 
 * @returns 
 */
const runQuery1 = async (id) => {
  const query1 = `
    MATCH (my_person:Person {did: \"${id}\"})-[:FOLLOW]->(follow_person:Person)\n
    MATCH (follow_person)-[:AUTHOR_OF]->(post:Post)\n
    WHERE post.indexedAt IS NOT NULL\n
    WITH localDateTime() - post.indexedAt AS how_old, post\n
    WHERE how_old.hour <= 24\n
    WITH cos(how_old.hour/15.28) AS most_recent_score, post\n
    OPTIONAL MATCH (:Person)-[l:LIKE]->(post)\n
    WITH count(l) AS num_of_likes, post, most_recent_score\n
    OPTIONAL MATCH (:Post)-[r:PARENT *]->(post)\n
    WITH count(r) AS num_of_comments, num_of_likes, post, most_recent_score\n
    RETURN 10 * (num_of_likes + num_of_comments + most_recent_score) AS popularity, post\n
    ORDER BY popularity DESC;
  `;

  return runQuery(query1);
}

/**
 * Get popularity score from people who are followed by the people I follow
 * by number of likes and comments and post age.
 * 
 * @param id 
 * @returns 
 */
const runQuery2 = async (id) => {
  const query2 = `
  MATCH (my_person:Person {did: \"${id}\"})-[:FOLLOW *2]->(follow_person:Person)\n
  WHERE NOT exists((my_person)-[:FOLLOW]->(follow_person))\n
  MATCH (follow_person)-[:AUTHOR_OF]->(post:Post)\n
  WHERE post.indexedAt IS NOT NULL\n
  WITH localDateTime() - post.indexedAt AS how_old, post\n
  WHERE how_old.hour <= 24\n
  WITH cos(how_old.hour/15.28) AS most_recent_score, post\n
  OPTIONAL MATCH (:Person)-[l:LIKE]->(post)\n
  WITH count(l) AS num_of_likes, post, most_recent_score\n
  OPTIONAL MATCH (:Post)-[r:PARENT *]->(post)\n
  WITH count(r) AS num_of_comments, num_of_likes, post, most_recent_score\n
  RETURN 1.5 * (num_of_likes + num_of_comments + most_recent_score) AS popularity, post\n
  ORDER BY popularity DESC;
  `;

  return runQuery(query2);
}

/**
 * Get popularity score from people in the same community by
 * number of likes and comments and post age.
 * 
 * @param id 
 * @returns 
 */
const runQuery3 = async (id) => {
  const query3 = `
    MATCH (my_person:Person {did: \"${id}\"}), (other_person:Person)\n
    WHERE other_person.did != my_person.did AND other_person.community_id = my_person.community_id AND NOT exists((my_person)-[:FOLLOW * 1..2]->(other_person)) \n
    MATCH (other_person)-[:AUTHOR_OF]->(post:Post)\n
    WHERE post.indexedAt IS NOT NULL\n
    WITH localDateTime() - post.indexedAt AS how_old, post\n
    WHERE how_old.hour <= 24\n
    WITH cos(how_old.hour/15.28) AS most_recent_score, post\n
    OPTIONAL MATCH (:Person)-[l:LIKE]->(post)\n
    WITH count(l) AS num_of_likes, post, most_recent_score\n
    OPTIONAL MATCH (:Post)-[r:PARENT *]->(post)\n
    WITH count(r) AS num_of_comments, num_of_likes, post, most_recent_score\n
    RETURN num_of_likes + num_of_comments + most_recent_score AS popularity, post\n
    ORDER BY popularity DESC; 
  `;

  return runQuery(query3);
}

const hostname = 'localhost';
const port = 3000;

const app = express()
app.use(helmet());
app.use(bodyParser.json());

app.get('/1/:id', async (req, res) => {
  const response = await runQuery1(req.params.id);
  res.json(response);
})

app.get('/2/:id', async (req, res) => {
  const response = await runQuery2(req.params.id);
  res.json(response);
})

app.get('/3/:id', async (req, res) => {
  const response = await runQuery3(req.params.id);
  res.json(response);
})


app.use(express.static(__dirname + '/public'));

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
