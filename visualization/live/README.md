### Query module

To run the visualization locally, you have to have the custom visualization query module loaded to Memgraph. To compile it, you can consult the README.md file in the query_module folder. 
Note: if you plan to run Memgraph on host (so not in a Docker container), you will have to change the hostname (line 12 in visualization.cpp) to 'http://localhost:3002'.

### Triggers

In order for the visualization to work, Memgraph needs to have certain triggers stored. You can create the necessary triggers using the following queries (each probably needs to be done separately):

```
DROP TRIGGER nodeCreate;
DROP TRIGGER relationshipCreate;
DROP TRIGGER nodeDelete;
DROP TRIGGER relationshipDelete;
DROP TRIGGER personEnrich;

CREATE TRIGGER nodeCreate ON () CREATE AFTER COMMIT EXECUTE
UNWIND createdVertices AS createdNode
RETURN visualization.create_node(createdNode);

CREATE TRIGGER relationshipCreate ON --> CREATE AFTER COMMIT EXECUTE
UNWIND createdEdges AS createdRelationship
RETURN visualization.handle_relationship(createdRelationship, "merge");

CREATE TRIGGER nodeDelete ON () DELETE BEFORE COMMIT EXECUTE
UNWIND deletedVertices AS deletedNode
RETURN visualization.delete_node(deletedNode);

CREATE TRIGGER relationshipDelete ON --> DELETE BEFORE COMMIT EXECUTE
UNWIND deletedEdges AS deletedRelationship
RETURN visualization.handle_relationship(deletedRelationship, "detach");

CREATE TRIGGER personEnrich ON () CREATE AFTER COMMIT EXECUTE
UNWIND createdVertices AS createdNode
RETURN CASE LABELS(createdNode)[0] WHEN 'Person' THEN visualization.enrich_person(createdNode.did) END;
```