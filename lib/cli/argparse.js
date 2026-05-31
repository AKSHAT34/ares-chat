// Tiny argparse — single-positional-command + boolean/string flags.
//
// Why not yargs/commander: this CLI is local, single-user, single-machine.
// We don't need subcommand-of-subcommand parsing, completion files, or
// chalk-flavoured help. 30 lines of regex covers it.
//
// Recognises:
//   --foo            → opts.foo = true              (boolean flag)
//   --foo=bar        → opts.foo = "bar"             (string flag)
//   --foo bar        → opts.foo = "bar"             (string flag)
//   command [...]    → first non-flag becomes command
//   --               → end-of-options sentinel
//
// Returns { command, opts } where opts._ is the residual positional args
// (including the command itself for compatibility with sub-subcommands).

export function parseArgs(argv, schema = {}) {
  const boolSet = new Set(schema.boolean || []);
  const strSet = new Set(schema.string || []);
  const positional = [];
  const opts = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--") {
      // Pass through remaining args literally
      for (let j = i + 1; j < argv.length; j++) positional.push(argv[j]);
      break;
    }
    const m = a.match(/^--([a-zA-Z][\w-]*)(?:=(.*))?$/);
    if (m) {
      const key = m[1];
      const inline = m[2];
      if (inline != null) {
        opts[key] = inline;
      } else if (boolSet.has(key)) {
        opts[key] = true;
      } else if (strSet.has(key)) {
        const next = argv[i + 1];
        if (next != null && !next.startsWith("--")) {
          opts[key] = next;
          i += 1;
        } else {
          opts[key] = true;
        }
      } else {
        // Unknown flag — treat as boolean true, no eat-next
        opts[key] = true;
      }
      i += 1;
      continue;
    }
    positional.push(a);
    i += 1;
  }
  opts._ = positional;
  const command = positional[0];
  return { command, opts };
}
