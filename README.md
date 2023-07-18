# Welcome to Home+

It's the Home feed Blue Sky was missing until now: A feed that shows those you care about, and adds interesting content from your extended social circles

It's the first fully algorithmic feed that offers a twitter home like experience, but without the engagement hacking


## Instructions

To run BlueJ, run the memgraph database by
```
docker run -it -p 7687:7687 -p 7444:7444 -p 3000:3000 memgraph/memgraph-platform
```

Or follow the instructions for your platform on https://memgraph.com/docs/memgraph/installation

## Indexes

Indexes are critical for performance, for each event that comes in the database needs to match user id's and post id's, and without indexes those take a looonnggg time (for a computer anyway), so once you have memgraph running, create indexes using this query:
```
CREATE INDEX ON :Person(did)
CREATE INDEX ON :Post(uri)
CREATE INDEX ON :Person
CREATE INDEX ON :Post
```

## Running

Once done, follow these steps to run:

1) `git clone https://github.com/memgraph/bluej.git`
2) `cd bluej`
3) `npm i`
4) `npm i -g ts-node`
5) `cp .env.example .env`
6) `ts-node src/index.ts`

To start creating your own feed, copy ./src/algos/home-plus.ts to a new file and register it in ./src/algos/index.ts. Restart ts-node and you should be able to call your feed by opening it up in your browser:
http://localhost:3001/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:ewgejell4547pukut5255ibm/app.bsky.feed.generator/home-plus&limit=20

Replace did:plc:ewgejell4547pukut5255ibm with the DID from your account (running `ts-node scripts/get-did.ts myhandle.bsky.social` can help you find it) and /home-plus with the name of your feed. If it works you should see an output like

```
{
   "cursor": "2500830::did:plc:ewgejell4547pukut5255ibm::20",
   "feed": [{
      "post": "at://did:plc:cak4klqoj3bqgk5rj6b4f5do/app.bsky.feed.post/3jxolhbl7ad2p"
   }, {
      "post": "at://did:plc:24lz3lshhmjsieafxih4exlw/app.bsky.feed.post/3jxofbiqcst2l"
   }, {
      "post": "at://did:plc:m2hze6zxa744iberzknpkc3i/app.bsky.feed.post/3jxoje7g57t2s"
   }, {
      "post": "at://did:plc:7eb2rkqterqn7zvs6r52jroz/app.bsky.feed.post/3jxolgv73hc2e"
   }, {
      "post": "at://did:plc:ydtsvzzsl6nlfkmnuooeqcmc/app.bsky.feed.post/3jxojj57p5w2l"
   }, {
      "post": "at://did:plc:hf7ezrajxadu7v3tzcyij424/app.bsky.feed.post/3jxolgpbd6u2w"
   }, {
      "post": "at://did:plc:l6arnocvhn2zrll2gn6xlxn2/app.bsky.feed.post/3jxoi34utet2s"
   }, {
      "post": "at://did:plc:oqbijttmayqui2xv3e2xwcdz/app.bsky.feed.post/3jxolgmf6x32u"
   }, {
      "post": "at://did:plc:hu2obebw3nhfj667522dahfg/app.bsky.feed.post/3jxoeyc7i3k2e"
   }, {
      "post": "at://did:plc:qvzn322kmcvd7xtnips5xaun/app.bsky.feed.post/3jxolgezvno2l"
   }, {
      "post": "at://did:plc:ydtsvzzsl6nlfkmnuooeqcmc/app.bsky.feed.post/3jxojxl2h3h2r"
   }, {
      "post": "at://did:plc:oqbijttmayqui2xv3e2xwcdz/app.bsky.feed.post/3jxolfi5tdl2s"
   }, {
      "post": "at://did:plc:siuuoqcskrsyg63qvqrgewtl/app.bsky.feed.post/3jxoj7hhlns2e"
   }, {
      "post": "at://did:plc:2gx2noukxzwmj6dkxbmh3qt5/app.bsky.feed.post/3jxolexxyzl2p"
   }, {
      "post": "at://did:plc:ydtsvzzsl6nlfkmnuooeqcmc/app.bsky.feed.post/3jxoime5o7q2e"
   }, {
      "post": "at://did:plc:hf7ezrajxadu7v3tzcyij424/app.bsky.feed.post/3jxolenqngs2e"
   }, {
      "post": "at://did:plc:s6j27rxb3ic2rxw73ixgqv2p/app.bsky.feed.post/3jxoh2ls34i2a"
   }, {
      "post": "at://did:plc:oqbijttmayqui2xv3e2xwcdz/app.bsky.feed.post/3jxolc4s5wl2s"
   }, {
      "post": "at://did:plc:hm4euky3y3a3dqrvstvbqakn/app.bsky.feed.post/3jxohoxpngh2r"
   }, {
      "post": "at://did:plc:7eb2rkqterqn7zvs6r52jroz/app.bsky.feed.post/3jxolb6pwwb2a"
   }]
}
```

