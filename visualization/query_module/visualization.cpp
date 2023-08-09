#include <mgp.hpp>
#include <curl/curl.h>
#include <string>
#include <string_view>
#include "json.hpp"

const char *argumentNode = "node";
const char *argumentRelationship = "relationship";

const std::string base_url = "http://192.168.0.18:8080";

void create_node(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto result = mgp::Result(res);

  try {
    auto node = arguments[0].ValueNode();
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
    
    curl = curl_easy_init();

    if (curl == NULL) {
      result.SetErrorMessage("Unable to create CURL handle.");
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
  } catch (const std::exception &e) {
    result.SetErrorMessage(e.what());
    return;
  }
}

void create_relationship(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto result = mgp::Result(res);

  try {
    auto relationship = arguments[0].ValueRelationship();
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
    
    curl = curl_easy_init();

    if (curl == NULL) {
      result.SetErrorMessage("Unable to create CURL handle.");
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
  } catch (const std::exception &e) {
    result.SetErrorMessage(e.what());
    return;
  }
}

void delete_node(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto result = mgp::Result(res);

  try {
    auto node = arguments[0].ValueNode();
    nlohmann::json json;

    std::string_view label = node.Labels()[0];
    if (label == "Person") {
      json["did"] = std::string(node.GetProperty("did").ValueString());
    } else if (label == "Post") {
      json["uri"] = std::string(node.GetProperty("uri").ValueString());

      auto author = node.GetProperty("author");
      if (author.Type() == mgp::Type::String) {
        json["author"] = std::string(author.ValueString());
      }
    }

    const std::string json_data = json.dump();

    CURL *curl;
    CURLcode response_code;
    
    curl = curl_easy_init();

    if (curl == NULL) {
      result.SetErrorMessage("Unable to create CURL handle.");
      return;
    }

    std::string url = base_url + "/delete";

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
  } catch (const std::exception &e) {
    result.SetErrorMessage(e.what());
    return;
  }
}

extern "C" int mgp_init_module(struct mgp_module *module, struct mgp_memory *memory) {
  try {
    mgp::memory = memory;

    mgp::AddFunction(create_node, "create_node", {
      mgp::Parameter(argumentNode, mgp::Type::Node)
    }, module, memory);

    mgp::AddFunction(create_relationship, "create_relationship", {
      mgp::Parameter(argumentRelationship, mgp::Type::Relationship)
    }, module, memory);

    mgp::AddFunction(delete_node, "delete_node", {
      mgp::Parameter(argumentNode, mgp::Type::Node)
    }, module, memory);

    curl_global_init(CURL_GLOBAL_ALL);
  } catch (const std::exception &e) {
    return 1;
  }
  return 0;
}

extern "C" int mgp_shutdown_module() { 
  try {
    curl_global_cleanup();
  } catch (const std::exception &e) {
    return 1;
  }
  return 0; 
}