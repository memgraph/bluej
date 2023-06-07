#include <mgp.hpp>

#include <cmath>
#include <list>

const char *kProcedureHackerNews = "hacker_news";
const char *kArgumentHackerNewsVotes = "votes";
const char *kArgumentHackerNewsItemHourAge = "item_hour_age";
const char *kArgumentHackerNewsGravity = "gravity";
const char *kReturnHackerNewsScore = "score";

void HackerNews(mgp_list *args, mgp_graph *memgraph_graph, mgp_result *result, mgp_memory *memory) {
  mgp::memory = memory;
  const auto &arguments = mgp::List(args);
  const auto record_factory = mgp::RecordFactory(result);
  try {
    const auto votes = arguments[0].ValueInt();
    const auto item_hour_age = arguments[1].ValueInt();
    const auto gravity = arguments[2].ValueDouble();
    const auto score = 1000000.0 * (votes / pow((item_hour_age + 2), gravity));
    auto record = record_factory.NewRecord();
    record.Insert(kReturnHackerNewsScore, score);
  } catch (const std::exception &e) {
    record_factory.SetErrorMessage(e.what());
    return;
  }
}

extern "C" int mgp_init_module(struct mgp_module *module, struct mgp_memory *memory) {
  try {
    mgp::memory = memory;
    std::vector<mgp::Parameter> params = {
        mgp::Parameter(kArgumentHackerNewsVotes, mgp::Type::Int),
        mgp::Parameter(kArgumentHackerNewsItemHourAge, mgp::Type::Int),
        mgp::Parameter(kArgumentHackerNewsGravity, mgp::Type::Double),
    };
    std::vector<mgp::Return> returns = {mgp::Return(kReturnHackerNewsScore, mgp::Type::Double)};
    AddProcedure(HackerNews, kProcedureHackerNews, mgp::ProcedureType::Read, params, returns, module, memory);
  } catch (const std::exception &e) {
    return 1;
  }
  return 0;
}

extern "C" int mgp_shutdown_module() { return 0; }
