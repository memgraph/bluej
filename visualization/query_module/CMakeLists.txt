# Add all module files related to graph util module
set(visualization_src visualization.cpp)
add_query_module(visualization 1 "${visualization_src}")

# Link external libraries
target_link_libraries(visualization PRIVATE ${CURL_LIBRARIES})
target_include_directories(visualization PRIVATE ${CURL_INCLUDE_DIRS})