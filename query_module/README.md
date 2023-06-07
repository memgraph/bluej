# Score algorithm c++ query module

To speed up the calculation of the score per post, this module implements both the famous HN ranking as well as a 
more flexible exponentially decaying scoring algorithm

To use this instead of the ranking in the cypher query replace:
```
(ceil(likes) / ceil(1 + (hour_age * hour_age * hour_age * hour_age))) as score, likes, hour_age, post
```

in the query with:

```
CALL bluej.hacker_news(likes, hour_age, 4.1) YIELD score
```



Instructions on how to build the memgraph query module:


```
docker run -d -p 7687:7687 --name bluej_module_builder memgraph/memgraph --telemetry-enabled=False

docker exec -u 0 -it bluej_module_builder

In the container run:

  apt update -y
  apt install -y git cmake gcc g++ vim clang-format
  cd /
  git clone https://github.com/memgraph/mage
  git submodule update --init --recursive 
  mkdir -p /mage/cpp/bluej
  cd /mage/cpp/bluej 
  cp CMake and bluej.cpp here

  /# append `add_subdirectory(bluej)` to the /mage/cpp/CMakeLists.txt

  mkdir -p /mage/cpp/build && cd /mage/cpp/build && cmake -DCMAKE_BUILD_TYPE=Release .. && make bluej

  /# here, /mage/cpp/build/bluej.so should exist and should be copied into /usr/lib/memgraph/query_modules
  /# Run this in mgconsole / lab to load the module:
  CALL mg.load_all();
