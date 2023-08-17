#include <mgp.hpp>
#include <curl/curl.h>
#include <thread>
#include <string>
#include "json.hpp"

const char *argumentNode = "node";
const char *argumentRelationship = "relationship";
const char *argumentAction = "action";
const char *argumentDid = "did";

const std::string base_url = "http://192.168.0.18:3002";
// const std::string base_url = "http://localhost:3002";

void create_node(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto result = mgp::Result(res);

  try {
    auto node = arguments[0].ValueNode();
    nlohmann::json json;

    json["type"] = std::string(node.Labels()[0]);

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

    const std::string url = base_url + "/create";

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

void handle_relationship(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto result = mgp::Result(res);

  try {
    auto relationship = arguments[0].ValueRelationship();
    const std::string action = std::string(arguments[1].ValueString());
    nlohmann::json json;

    std::string type = std::string(relationship.Type());
    json["type"] = type;
    
    auto source_node = relationship.From();
    auto target_node = relationship.To();

    if (type == "AUTHOR_OF") {
      json["source"] = std::string(source_node.GetProperty("did").ValueString());
      json["target"] = std::string(target_node.GetProperty("uri").ValueString());
    } else if (type == "FOLLOW") {
      json["source"] = std::string(source_node.GetProperty("did").ValueString());
      json["target"] = std::string(target_node.GetProperty("did").ValueString());    
    } else if (type == "LIKE") {
      json["source"] = std::string(source_node.GetProperty("did").ValueString());
      json["target"] = std::string(target_node.GetProperty("uri").ValueString());
    } else if (type == "ROOT") {
      json["source"] = std::string(source_node.GetProperty("uri").ValueString());
      json["target"] = std::string(target_node.GetProperty("uri").ValueString());

      auto author = source_node.GetProperty("author");
      if (author.Type() == mgp::Type::String) {
        json["author"] = std::string(author.ValueString());
      }
    } else if (type == "PARENT") {
      json["source"] = std::string(source_node.GetProperty("uri").ValueString());
      json["target"] = std::string(target_node.GetProperty("uri").ValueString());

      auto author = source_node.GetProperty("author");
      if (author.Type() == mgp::Type::String) {
        json["author"] = std::string(author.ValueString());
      }
    } else if (type == "REPOST_OF") {
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

    const std::string url = base_url + "/" + action;

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

    std::string label = std::string(node.Labels()[0]);
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

    const std::string url = base_url + "/delete";

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

void execute_enrich_person(std::string did) {
  try {
    nlohmann::json json;
    json["did"] = did;
    const std::string json_data = json.dump();

    CURL *curl;
    
    curl = curl_easy_init();

    if (curl == NULL) {
      return;
    }

    const std::string url = base_url + "/enrich/person";

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "charset: utf-8");

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data.c_str());

    curl_easy_perform(curl);
    
    curl_easy_cleanup(curl);
  } catch (const std::exception &e) {
    return;
  }
}

void enrich_person(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto result = mgp::Result(res);

  try {
    const std::string did = std::string(arguments[0].ValueString());

    std::thread t(execute_enrich_person, did);
    t.detach();

    result.SetValue(did);
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

    mgp::AddFunction(handle_relationship, "handle_relationship", {
      mgp::Parameter(argumentRelationship, mgp::Type::Relationship),
      mgp::Parameter(argumentAction, mgp::Type::String)
    }, module, memory);

    mgp::AddFunction(delete_node, "delete_node", {
      mgp::Parameter(argumentNode, mgp::Type::Node)
    }, module, memory);

    mgp::AddFunction(enrich_person, "enrich_person", {
      mgp::Parameter(argumentDid, mgp::Type::String)
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