#include <mgp.hpp>
#include <curl/curl.h>

const char* base_url = "http://192.168.0.18:8080/status";

void test_func(mgp_list *args, mgp_func_context *ctx, mgp_func_result *res, mgp_memory *memory) {
  mgp::memory = memory;
  const auto arguments = mgp::List(args);
  auto num = arguments[0].ValueInt();
  auto err = arguments[1].ValueInt();

  auto result = mgp::Result(res);

  CURL *curl;
  CURLcode response_code;
  
  curl_global_init(CURL_GLOBAL_ALL);
  curl = curl_easy_init();

  if (curl == NULL) {
    result.SetValue(err);
    curl_global_cleanup();
    return;
  }

  // struct curl_slist *headers = NULL;
  // headers = curl_slist_append(headers, "Content-Type: application/json");
  // headers = curl_slist_append(headers, "charset: utf-8");

  // const char* json_data = "{ \"type\" : \"post\" , \"uri\" : \"uriToPost\" , \"cid\" : \"postCID\" , \"author\" : \"DJ\" , \"text\" : \"Lorem ipsum.\" , \"createdAt\" : \"07.08.2023\" }";

  curl_easy_setopt(curl, CURLOPT_URL, base_url);
  // curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  // curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data);
  // curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, strlen(json_data));

  response_code = curl_easy_perform(curl);

  if (response_code == CURLE_OK) {
    result.SetValue(num);
  } else {
    result.SetErrorMessage(curl_easy_strerror(response_code));
  }

  curl_easy_cleanup(curl);
  curl_global_cleanup();
}

extern "C" int mgp_init_module(struct mgp_module *module, struct mgp_memory *memory) {
  try {
    mgp::memory = memory;

    std::vector<mgp::Parameter> params = {
        mgp::Parameter("num", mgp::Type::Int),
        mgp::Parameter("err", mgp::Type::Int)
    };

    mgp::AddFunction(test_func, "test_func", params, module, memory);
  } catch (const std::exception &e) {
    return 1;
  }
  return 0;
}

extern "C" int mgp_shutdown_module() { return 0; }