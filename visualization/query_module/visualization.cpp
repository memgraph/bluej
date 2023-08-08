#include <mgp.hpp>
#include <curl/curl.h>
#include <string>
#include <string_view>

const std::string base_url = "http://192.168.0.18:8080";

std::string trim(const std::string& str) {
    size_t start = str.find_first_not_of(" \t\n\r");
    size_t end = str.find_last_not_of(" \t\n\r");

    if (start == std::string::npos) {
        return "";
    }

    return str.substr(start, end - start + 1);
}

void test_func(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto num = arguments[0].ValueInt();

  auto result = mgp::Result(res);

  CURL *curl;
  CURLcode response_code;
  
  curl_global_init(CURL_GLOBAL_ALL);
  curl = curl_easy_init();

  if (curl == NULL) {
    result.SetErrorMessage("Unable to create CURL handle.");
    curl_global_cleanup();
    return;
  }

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  headers = curl_slist_append(headers, "charset: utf-8");

  const char* json_data = "{ \"type\" : \"post\" , \"uri\" : \"uriToPost\" , \"cid\" : \"postCID\" , \"author\" : \"DJ\" , \"text\" : \"Lorem ipsum.\" , \"createdAt\" : \"07.08.2023\" }";

  curl_easy_setopt(curl, CURLOPT_URL, base_url.c_str());
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data);

  response_code = curl_easy_perform(curl);

  if (response_code == CURLE_OK) {
    result.SetValue(num);
  } else {
    result.SetErrorMessage(curl_easy_strerror(response_code));
  }

  curl_easy_cleanup(curl);
  curl_global_cleanup();
}

void create_node(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;

  const auto arguments = mgp::List(args);
  auto node = arguments[0].ValueNode();

  auto result = mgp::Result(res);
  std::string json_data = "";

  std::string_view label = node.Labels()[0];
  if (label == "Person") {
    json_data += "{ \"type\": \"person\" , ";
  } else if (label == "Post") {
    json_data += "{ \"type\": \"post\" , ";
  }

  for (const auto& [key, value] : node.Properties()) {
    if (value.Type() == mgp::Type::String && key != "text") {
      json_data += ("\"" + std::string(key) + "\" : \"" + trim(std::string(value.ValueString())) + "\" , ");
    }
  }

  json_data = json_data.substr(0, json_data.length() - 3);
  json_data += " }";

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

extern "C" int mgp_init_module(struct mgp_module *module, struct mgp_memory *memory) {
  try {
    mgp::memory = memory;

    mgp::AddFunction(test_func, "test_func", {
        mgp::Parameter("num", mgp::Type::Int)
    }, module, memory);

    mgp::AddFunction(create_node, "create_node", {
        mgp::Parameter("node", mgp::Type::Node)
    }, module, memory);
  } catch (const std::exception &e) {
    return 1;
  }
  return 0;
}

extern "C" int mgp_shutdown_module() { return 0; }