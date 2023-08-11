const { verbose } = require('../config');
const { driver, agent } = require('../index');

const enrichPerson = async (did) => {
    try {
        const user = await agent.getProfile({actor: did});

        if (!user) {
            if (verbose) {
                console.log('Failed to fetch user profile.');
            }

            return;
        }

        const session = driver.session();
        let cypher = `MATCH (p:Person) WHERE p.did = $did SET `;

        const parameters = {
            did: user?.data.did || "",
            handle: user?.data.handle || "",
            displayName: user?.data.displayName || "",
            description: user?.data.description || "",
            avatar: user?.data.avatar || "",
            followsCount: user?.data.followsCount || "",
            followersCount: user?.data.followersCount || ""
        };
        
        const setClauses = Object.entries(parameters)
            .filter(([key, value]) => value !== null && value !== "" && key !== "did")
            .map(([key, value]) => `p.${key} = $${key}`)
            .join(', ');

        cypher += setClauses;

        const result = await session.run(cypher, parameters); 
        session.close();

        return result;
    } catch (err) {
        if (verbose) {
            console.log(err);
        }
        
        return;
    }
}

module.exports = enrichPerson;