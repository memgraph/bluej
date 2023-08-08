# Instructions on how to build the Memgraph query module

First run the following two commands to start running Memgraph Platform and setup a bash commandline which we will use for the next steps:

```
docker run -d -it -p 7687:7687 -p 7444:7444 -p 3000:3000 --name visualization_module_builder memgraph/memgraph-platform
docker exec -u 0 -it visualization_module_builder bash
```

Now run:

```
  apt update -y
  apt install -y git cmake gcc g++ vim clang-format libcurl4-openssl-dev
  git clone https://github.com/memgraph/mage
  cd mage
  git submodule update --init --recursive 
  mkdir -p /mage/cpp/visualization
```

Now you need to copy the CMakeLists.txt and visualization.cpp files to /mage/cpp/visualization:
In another shell:

```
    docker ps
```

Copy the container ID
Position yourself in this folder (bluej/visualization/query_module)
Now run the following two lines:

```
    docker cp ./CMakeLists.txt <containerID>:/mage/cpp/visualization
    docker cp ./json.hpp <containerID>:/mage/cpp/visualization
    docker cp ./visualization.cpp <containerID>:/mage/cpp/visualization
```

We need to append the line "add_subdirectory(visualization)" to the /mage/cpp/CMakeLists.txt file.
To do that, run the following commands back in the first shell:

```
  cd /mage/cpp
  echo "add_subdirectory(visualization)" >> CMakeLists.txt
```

Finally, run the following commands to build the visualization.so shared object:

```
  mkdir -p /mage/cpp/build
  cd /mage/cpp/build
  cmake -DCMAKE_BUILD_TYPE=Release ..
  make visualization
```

Now, the file visualization.so should exist in folder /mage/cpp/build/visualization. The final step is to copy it to /usr/lib/memgraph/query_modules (all MAGE query modules are stored here):

```
  cd visualization
  cp visualization.so /usr/lib/memgraph/query_modules
```

To test if it works, run the following Cypher query in Memgraph Lab or mgconsole:

```
  CALL mg.load_all();
```

Now, you can check if the visualization query module exists (in Memgraph Lab, check the Query modules tab) and call its functions.