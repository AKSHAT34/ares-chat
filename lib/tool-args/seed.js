// Phase RP1-B3 — seed list of arg-fixes baked into source.
//
// These are battle-tested fixes for the most common arg-shape errors
// across the MCPs Ares actually uses every day. Each entry is:
//
//   {
//     toolName:       prefixed tool name ("server__tool")
//     errorRegex:     pattern that matches the error text the MCP
//                     returns when this fix would help
//     transform:      one of the primitives in transforms.js
//     promoted:       true (seed entries skip the 3-success threshold)
//     applications:   running count
//     successes:      running count
//   }
//
// Seed entries are PROMOTED out of the gate so they apply on the
// first relevant call. New runtime-learned candidates start
// unpromoted and need 3 successful applications to flip.

export const SEED_FIXES = [
  // data-query-mcp — every query needs data_query_mcp_user_context. The agent
  // reliably forgets it on the first call of each session.
  {
    toolName: "data-query-mcp__execute_query",
    errorRegex: "data_query_mcp_user_context.*required|missing.*data_query_mcp_user_context",
    transform: "inject:data_query_mcp_user_context={\"requester\":\"ares-chat\"}",
    promoted: true,
    applications: 0,
    successes: 0,
  },
  // wiki-mcp — InternalCodeSearch / InternalSearch take {inputs:[{query}]}, not {query}.
  {
    toolName: "wiki-mcp__InternalCodeSearch",
    errorRegex: "expected.*inputs.*array|missing required parameter.*inputs",
    transform: "rename:query->inputs",
    promoted: true,
    applications: 0,
    successes: 0,
  },
  // example-mcp — vendorCode is canonical; some tools accept vendor_code.
  {
    toolName: "example-mcp__GetVendorConfiguration",
    errorRegex: "unknown parameter.*vendor_code|missing required.*vendorCode",
    transform: "rename:vendor_code->vendorCode",
    promoted: true,
    applications: 0,
    successes: 0,
  },
  // email-mcp — email_search expects an array of folder ids,
  // model often passes a string.
  {
    toolName: "email-mcp__email_search",
    errorRegex: "expected array.*folders|folders must be a list",
    transform: "coerce:folders:array",
    promoted: true,
    applications: 0,
    successes: 0,
  },
];
