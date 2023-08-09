#include <mgp.hpp>
#include <curl/curl.h>
#include <string>
#include <string_view>
#include "json.hpp"

const std::string base_url = "http://192.168.0.18:8080";

void create_node(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;

  const auto arguments = mgp::List(args);
  auto node = arguments[0].ValueNode();

  auto result = mgp::Result(res);
  nlohmann::json json;

  std::string_view label = node.Labels()[0];
  if (label == "Person") {
    json["type"] = "person";
  } else if (label == "Post") {
    json["type"] = "post";
  }

  for (const auto& [key, value] : node.Properties()) {
    if (value.Type() == mgp::Type::String) {
      json[std::string(key)] = std::string(value.ValueString());
    }
  }

  const std::string json_data = json.dump();

  CURL *curl;
  CURLcode response_code;
  
  curl_global_init(CURL_GLOBAL_ALL);
  curl = curl_easy_init();

  if (curl == NULL) {
    result.SetErrorMessage("Unable to create CURL handle.");
    curl_global_cleanup();
    return;
  }

  std::string url = base_url + "/create";

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  headers = curl_slist_append(headers, "charset: utf-8");

  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data.c_str());

  response_code = curl_easy_perform(curl);

  if (response_code == CURLE_OK) {
    result.SetValue(json_data);
  } else {
    result.SetErrorMessage(curl_easy_strerror(response_code));
  }

  curl_easy_cleanup(curl);
  curl_global_cleanup();
}

void create_relationship(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;

  const auto arguments = mgp::List(args);
  auto relationship = arguments[0].ValueRelationship();

  auto result = mgp::Result(res);
  nlohmann::json json;

  std::string_view type = relationship.Type();
  auto source_node = relationship.From();
  auto target_node = relationship.To();

  if (type == "AUTHOR_OF") {
    json["type"] = "author_of";
    json["source"] = std::string(source_node.GetProperty("did").ValueString());
    json["target"] = std::string(target_node.GetProperty("uri").ValueString());
  } else if (type == "FOLLOW") {
    json["type"] = "follow";
    json["source"] = std::string(source_node.GetProperty("did").ValueString());
    json["target"] = std::string(target_node.GetProperty("did").ValueString());    
  } else if (type == "LIKE") {
    json["type"] = "like";
    json["source"] = std::string(source_node.GetProperty("did").ValueString());
    json["target"] = std::string(target_node.GetProperty("uri").ValueString());
  } else if (type == "ROOT") {
    json["type"] = "root";
    json["source"] = std::string(source_node.GetProperty("uri").ValueString());
    json["target"] = std::string(target_node.GetProperty("uri").ValueString());

    auto author = source_node.GetProperty("author");
    if (author.Type() == mgp::Type::String) {
      json["author"] = std::string(author.ValueString());
    }
  } else if (type == "PARENT") {
    json["type"] = "parent";
    json["source"] = std::string(source_node.GetProperty("uri").ValueString());
    json["target"] = std::string(target_node.GetProperty("uri").ValueString());

    auto author = source_node.GetProperty("author");
    if (author.Type() == mgp::Type::String) {
      json["author"] = std::string(author.ValueString());
    }
  } else if (type == "REPOST_OF") {
    json["type"] = "repost_of";
    json["source"] = std::string(source_node.GetProperty("uri").ValueString());
    json["target"] = std::string(target_node.GetProperty("uri").ValueString());

    auto author = source_node.GetProperty("author");
    if (author.Type() == mgp::Type::String) {
      json["author"] = std::string(author.ValueString());
    }
  }

  const std::string json_data = json.dump();

  CURL *curl;
  CURLcode response_code;
  
  curl_global_init(CURL_GLOBAL_ALL);
  curl = curl_easy_init();

  if (curl == NULL) {
    result.SetErrorMessage("Unable to create CURL handle.");
    curl_global_cleanup();
    return;
  }

  std::string url = base_url + "/merge";

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  headers = curl_slist_append(headers, "charset: utf-8");

  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data.c_str());

  response_code = curl_easy_perform(curl);

  if (response_code == CURLE_OK) {
    result.SetValue(json_data);
  } else {
    result.SetErrorMessage(curl_easy_strerror(response_code));
  }

  curl_easy_cleanup(curl);
  curl_global_cleanup();
}

extern "C" int mgp_init_module(struct mgp_module *module, struct mgp_memory *memory) {
  try {
    mgp::memory = memory;

    // std::vector<mgp::Parameter> create_node_params = {
    //     mgp::Parameter("node", mgp::Type::Node)
    // };

    mgp::AddFunction(create_node, "create_node", {
        mgp::Parameter("node", mgp::Type::Node)
    }, module, memory);

    // std::vector<mgp::Parameter> create_relationship_params = {
    //     mgp::Parameter("relationship", mgp::Type::Relationship)
    // };

    mgp::AddFunction(create_relationship, "create_relationship", {
        mgp::Parameter("relationship", mgp::Type::Relationship)
    }, module, memory);
  } catch (const std::exception &e) {
    return 1;
  }
  return 0;
}

extern "C" int mgp_shutdown_module() { return 0; }